-- =============================================================
-- PROTECTED RPC CHANGE: c1_message_next_action
-- =============================================================
-- Safe Modification Protocol:
--   Backup: supabase/rollbacks/ (original in 20260327041845_remote_schema.sql:5738)
--   Approved by: Adam (YAR-157 + YAR-36)
--
-- Fix: Skip landlord approval when landlord_id IS NULL on the property,
-- not just when require_landlord_approval = false.
-- Without this, the dispatcher sends a landlord SMS to a null phone number,
-- which silently fails and blocks the job from progressing.
--
-- Change is surgical: only the landlord-check query (section 2) is modified.
-- Adds p.landlord_id to the SELECT and checks it alongside require_landlord_approval.
-- =============================================================

CREATE OR REPLACE FUNCTION public.c1_message_next_action(p_ticket_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
AS $function$
DECLARE
  v_msg           public.c1_messages%rowtype;
  v_ticket        public.c1_tickets%rowtype;
  v_mgr           jsonb;
  v_contractors   jsonb;

  v_first_pending jsonb;
  v_first_sent    jsonb;
  v_first_replied jsonb;

  v_media_base    text;
  v_instruction   text := 'no-action';
  v_payload       jsonb := '{}';

  v_mgr_approval  text;
  v_any_pending   boolean := false;
  v_any_sent      boolean := false;
  v_any_replied   boolean := false;
  v_all_exhausted boolean := false;

  v_dispatch_mode text := 'sequential';
  v_contractor    jsonb;
  v_ticket_payload jsonb;

  v_require_landlord boolean;
  v_landlord_id      uuid;   -- ← NEW: track whether landlord exists
BEGIN
  -- Prevent loops from self / mark_sent functions
  IF current_setting('application_name', true) IN (
    'c1_message_next_action',
    'c1_contractor_mark_sent',
    'c1_pm_mark_sent',
    'c1_landlord_mark_sent'
  ) THEN
    RETURN NULL;
  END IF;

  -- Suppress dispatcher during state changes
  PERFORM set_config('application_name','c1_message_next_action', true);
  UPDATE public.c1_messages
     SET suppress_webhook = true
   WHERE ticket_id = p_ticket_id;
  PERFORM set_config('application_name','', true);

  -- Load state
  SELECT * INTO v_msg FROM public.c1_messages WHERE ticket_id = p_ticket_id;
  IF NOT FOUND THEN
    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction','no-action','reason','no-message-row');
  END IF;

  SELECT * INTO v_ticket FROM public.c1_tickets WHERE id = p_ticket_id;
  IF NOT FOUND THEN
    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction','no-action','reason','no-ticket-row');
  END IF;

  v_mgr := coalesce(v_msg.manager, '{}'::jsonb);
  v_contractors := coalesce(v_msg.contractors, '[]'::jsonb);
  v_media_base := 'ticket-images/' || p_ticket_id::text;

  -- Load dispatch mode from PM settings
  SELECT COALESCE(pm.dispatch_mode, 'sequential')
    INTO v_dispatch_mode
    FROM public.c1_property_managers pm
   WHERE pm.id = v_ticket.property_manager_id;

  -- Derivations
  v_first_replied := (
    SELECT elem FROM jsonb_array_elements(v_contractors) elem
    WHERE elem->>'status' = 'replied'
    ORDER BY (elem->>'replied_at')::timestamptz DESC NULLS LAST
    LIMIT 1
  );
  v_any_replied := v_first_replied IS NOT NULL;

  v_first_pending := (
    SELECT elem FROM jsonb_array_elements(v_contractors) elem
    WHERE coalesce(elem->>'status','pending') = 'pending'
    LIMIT 1
  );
  v_any_pending := v_first_pending IS NOT NULL;

  v_first_sent := (
    SELECT elem FROM jsonb_array_elements(v_contractors) elem
    WHERE elem->>'status' = 'sent'
    LIMIT 1
  );
  v_any_sent := v_first_sent IS NOT NULL;

  v_all_exhausted := (NOT v_any_pending) AND (NOT v_any_sent) AND (NOT v_any_replied);

  -- Normalise stage for UI only
  IF v_msg.stage IS NULL THEN
    UPDATE public.c1_messages
       SET stage = 'waiting_contractor', updated_at = now()
     WHERE ticket_id = p_ticket_id;
    v_msg.stage := 'waiting_contractor';
  END IF;

  v_mgr_approval := (v_mgr->>'approval');

  --------------------------------------------------------------------
  -- 1) PM review branch
  --------------------------------------------------------------------
  IF v_any_replied
     AND coalesce(v_mgr_approval,'') <> 'true'
     AND (
          (v_mgr->>'reviewing_contractor_id') IS NULL
          OR (v_mgr->>'reviewing_contractor_id') <> (v_first_replied->>'id')
         )
  THEN
    v_instruction := 'pm-sms';
    v_payload := jsonb_build_object(
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'issue_description', v_ticket.issue_description,
        'priority', v_ticket.priority,
        'category', v_ticket.category,
        'images', coalesce(to_jsonb(v_ticket.images),'[]'::jsonb)
      ),
      'manager', v_mgr,
      'contractor', v_first_replied,
      'media_public_base', v_media_base
    );

    UPDATE public.c1_messages
       SET stage = 'awaiting_manager',
           manager = jsonb_set(
                      (coalesce(v_mgr,'{}'::jsonb) - 'approval' - 'approval_amount'),
                      '{reviewing_contractor_id}',
                      to_jsonb((v_first_replied->>'id')::uuid),
                      true
                    ),
           updated_at = now()
     WHERE ticket_id = p_ticket_id;

    PERFORM net.http_post(
      url := 'https://qedsceehrrvohsjmbodc.supabase.co/functions/v1/yarro-dispatcher',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('instruction', v_instruction, 'payload', v_payload)
    );

    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction', v_instruction, 'payload', v_payload);
  END IF;

  --------------------------------------------------------------------
  -- 2) Manager approved → landlord (with require_landlord_approval check)
  --    FIX (YAR-157 + YAR-36): also skip when landlord_id IS NULL
  --------------------------------------------------------------------
  IF v_mgr_approval = 'true' THEN
    v_first_replied := COALESCE(
      (
        SELECT elem FROM jsonb_array_elements(v_contractors) elem
        WHERE elem->>'id' = (v_mgr->>'reviewing_contractor_id')
        LIMIT 1
      ),
      v_first_replied
    );

    -- Check if landlord approval is required AND a landlord exists
    SELECT COALESCE(p.require_landlord_approval, true), p.landlord_id
      INTO v_require_landlord, v_landlord_id
      FROM c1_properties p
      JOIN c1_tickets t ON t.property_id = p.id
     WHERE t.id = p_ticket_id;

    IF NOT COALESCE(v_require_landlord, true) OR v_landlord_id IS NULL THEN
      -- Skip landlord entirely → go straight to scheduling
      UPDATE public.c1_messages
         SET stage = 'landlord_skipped',
             landlord = COALESCE(v_msg.landlord, '{}'::jsonb) || '{"approval": "true"}'::jsonb,
             updated_at = now()
       WHERE ticket_id = p_ticket_id;

      UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;

      -- Fire scheduling directly (same as post-landlord-approval path)
      PERFORM public.c1_finalize_job(p_ticket_id);

      RETURN jsonb_build_object(
        'instruction', 'landlord-skipped',
        'reason', CASE
          WHEN v_landlord_id IS NULL THEN 'no_landlord_assigned'
          ELSE 'require_landlord_approval_false'
        END
      );
    END IF;

    -- Existing flow: send landlord approval request
    v_instruction := 'landlord-sms';
    v_payload := jsonb_build_object(
      'ticket', jsonb_build_object(
        'id', v_ticket.id,
        'issue_description', v_ticket.issue_description,
        'priority', v_ticket.priority,
        'category', v_ticket.category,
        'images', coalesce(to_jsonb(v_ticket.images),'[]'::jsonb)
      ),
      'manager', v_mgr,
      'chosen_contractor', v_first_replied,
      'media_public_base', v_media_base
    );

    UPDATE public.c1_messages
       SET stage = 'awaiting_landlord',
           updated_at = now()
     WHERE ticket_id = p_ticket_id;

    PERFORM net.http_post(
      url := 'https://qedsceehrrvohsjmbodc.supabase.co/functions/v1/yarro-dispatcher',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('instruction', v_instruction, 'payload', v_payload)
    );

    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction', v_instruction, 'payload', v_payload);
  END IF;

  --------------------------------------------------------------------
  -- 3) Manager declined → tag history
  --------------------------------------------------------------------
  IF v_mgr_approval = 'false' THEN
    IF (v_mgr->>'reviewing_contractor_id') IS NOT NULL THEN
      PERFORM public.c1_msg_merge_contractor(
        p_ticket_id,
        ((v_mgr->>'reviewing_contractor_id')::uuid),
        jsonb_build_object('status','declined_by_manager','declined_at', to_jsonb(now()))
      );
    END IF;
  END IF;

  --------------------------------------------------------------------
  -- 4) Contractor selection / dispatch logic
  --------------------------------------------------------------------

  -- Build ticket payload once for reuse
  v_ticket_payload := jsonb_build_object(
    'id', v_ticket.id,
    'issue_description', v_ticket.issue_description,
    'priority', v_ticket.priority,
    'category', v_ticket.category,
    'images', coalesce(to_jsonb(v_ticket.images),'[]'::jsonb)
  );

  -- 4a) BROADCAST: send to ALL pending contractors at once
  IF v_dispatch_mode = 'broadcast' AND v_any_pending THEN

    FOR v_contractor IN
      SELECT elem FROM jsonb_array_elements(v_contractors) elem
      WHERE coalesce(elem->>'status','pending') = 'pending'
    LOOP
      PERFORM net.http_post(
        url := 'https://qedsceehrrvohsjmbodc.supabase.co/functions/v1/yarro-dispatcher',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := jsonb_build_object(
          'instruction', 'contractor-sms',
          'payload', jsonb_build_object(
            'ticket', v_ticket_payload,
            'manager', v_mgr,
            'contractor', v_contractor,
            'media_public_base', v_media_base
          )
        )
      );
    END LOOP;

    UPDATE public.c1_messages
       SET stage = 'waiting_contractor',
           updated_at = now()
     WHERE ticket_id = p_ticket_id;

    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction', 'contractor-sms-broadcast', 'count', (
      SELECT count(*) FROM jsonb_array_elements(v_contractors) elem
      WHERE coalesce(elem->>'status','pending') = 'pending'
    ));

  -- 4b) SEQUENTIAL: send to ONE pending contractor (existing behavior)
  ELSIF v_any_pending AND NOT v_any_sent THEN
    v_instruction := 'contractor-sms';
    v_payload := jsonb_build_object(
      'ticket', v_ticket_payload,
      'manager', v_mgr,
      'contractor', v_first_pending,
      'media_public_base', v_media_base
    );

    UPDATE public.c1_messages
       SET stage = 'waiting_contractor',
           updated_at = now()
     WHERE ticket_id = p_ticket_id;

    PERFORM net.http_post(
      url := 'https://qedsceehrrvohsjmbodc.supabase.co/functions/v1/yarro-dispatcher',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('instruction', v_instruction, 'payload', v_payload)
    );

    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction', v_instruction, 'payload', v_payload);

  -- 4c) All exhausted — but ONLY fire notification if not already in this state
  ELSIF v_all_exhausted AND v_msg.stage <> 'no_contractors_left' THEN
    v_instruction := 'pm-nomorecontractors-sms';
    v_payload := jsonb_build_object(
      'ticket', v_ticket_payload,
      'manager', v_mgr,
      'property', (
        SELECT jsonb_build_object('address', p.address)
        FROM c1_properties p
        WHERE p.id = v_ticket.property_id
      )
    );

    UPDATE public.c1_messages
       SET stage = 'no_contractors_left',
           updated_at = now()
     WHERE ticket_id = p_ticket_id;

    PERFORM net.http_post(
      url := 'https://qedsceehrrvohsjmbodc.supabase.co/functions/v1/yarro-dispatcher',
      headers := '{"Content-Type": "application/json"}'::jsonb,
      body := jsonb_build_object('instruction', v_instruction, 'payload', v_payload)
    );

    UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
    RETURN jsonb_build_object('instruction', v_instruction, 'payload', v_payload);
  END IF;

  UPDATE public.c1_messages SET suppress_webhook = false WHERE ticket_id = p_ticket_id;
  RETURN jsonb_build_object('instruction','no-action');
END;
$function$;
