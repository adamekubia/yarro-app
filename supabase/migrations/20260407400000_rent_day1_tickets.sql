-- ============================================================
-- Sprint 02: Rent Overdue → Real Tickets from Day 1
-- ============================================================
-- Issues: YAR-222, YAR-223
-- Branch: fix/yar-222-223-rent-as-tickets
--
-- Protected RPCs modified (Safe Modification Protocol):
--   1. create_rent_arrears_ticket — add p_priority parameter
--   2. compute_rent_arrears_next_action — add priority escalation
--   3. c1_get_dashboard_todo — add rent-specific labels
--
-- Non-protected RPCs modified:
--   4. get_rent_reminders_due — add property_id + 4th branch for overdue entries
--   5. c1_get_dashboard_todo_extras — remove rent pseudo-items
--
-- Previous versions:
--   create_rent_arrears_ticket: 20260404300000_polymorphic_subroutines.sql:278
--   compute_rent_arrears_next_action: 20260404300000_polymorphic_subroutines.sql:148
--   c1_get_dashboard_todo: 20260407100000_dashboard_todo_sla_due_at.sql
--   get_rent_reminders_due: 20260402000000_end_tenancy.sql:94
--   c1_get_dashboard_todo_extras: 20260407300000_compliance_priority_tiers.sql
-- ============================================================


-- ─── 1. create_rent_arrears_ticket (PROTECTED) ─────────────────────────

CREATE OR REPLACE FUNCTION public.create_rent_arrears_ticket(
  p_property_manager_id uuid,
  p_property_id uuid,
  p_tenant_id uuid,
  p_issue_title text,
  p_issue_description text,
  p_priority text DEFAULT 'Medium'
) RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_ticket_id uuid;
BEGIN
  -- Dedup: only one open rent_arrears ticket per tenant
  SELECT id INTO v_ticket_id
  FROM c1_tickets
  WHERE tenant_id = p_tenant_id
    AND category = 'rent_arrears'
    AND status = 'open';

  IF FOUND THEN
    -- Ticket already exists — update title, description + escalate priority (never downgrade)
    UPDATE c1_tickets
    SET issue_title = p_issue_title,
        issue_description = p_issue_description,
        priority = CASE
          WHEN p_priority = 'Urgent' THEN 'Urgent'
          WHEN p_priority = 'High' AND priority NOT IN ('Urgent') THEN 'High'
          WHEN p_priority = 'Medium' AND priority NOT IN ('Urgent', 'High') THEN 'Medium'
          ELSE priority
        END
    WHERE id = v_ticket_id;
    RETURN v_ticket_id;
  END IF;

  -- Create new ticket (no c1_messages, no dispatch — PM-only action)
  INSERT INTO c1_tickets (
    status, date_logged, tenant_id, property_id, property_manager_id,
    issue_title, issue_description, category, priority,
    job_stage, verified_by, is_manual, handoff
  ) VALUES (
    'open', now(), p_tenant_id, p_property_id, p_property_manager_id,
    p_issue_title, p_issue_description, 'rent_arrears', p_priority,
    'created', 'system', true, false
  ) RETURNING id INTO v_ticket_id;

  RETURN v_ticket_id;
END;
$$;


-- ─── 2. compute_rent_arrears_next_action (PROTECTED) ───────────────────

CREATE OR REPLACE FUNCTION public.compute_rent_arrears_next_action(
  p_ticket_id uuid,
  p_ticket c1_tickets
)
RETURNS TABLE(next_action text, next_action_reason text)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_months_overdue integer;
  v_total_arrears numeric;
  v_has_partial boolean;
  v_earliest_due date;
  v_days_overdue integer;
  v_new_priority text;
  v_effective_priority text;
BEGIN
  -- ── Priority escalation based on earliest overdue due_date ──
  SELECT MIN(due_date) INTO v_earliest_due
  FROM c1_rent_ledger
  WHERE tenant_id = p_ticket.tenant_id
    AND status IN ('overdue', 'partial');

  IF v_earliest_due IS NOT NULL THEN
    v_days_overdue := (CURRENT_DATE - v_earliest_due);

    v_new_priority := CASE
      WHEN v_days_overdue >= 14 THEN 'Urgent'
      WHEN v_days_overdue >= 7  THEN 'High'
      ELSE 'Medium'
    END;

    -- Compute effective priority (only escalate, never downgrade)
    v_effective_priority := CASE
      WHEN v_new_priority = 'Urgent' THEN 'Urgent'
      WHEN v_new_priority = 'High' AND p_ticket.priority NOT IN ('Urgent') THEN 'High'
      ELSE p_ticket.priority
    END;

    IF v_effective_priority IS DISTINCT FROM p_ticket.priority THEN
      UPDATE c1_tickets SET priority = v_effective_priority WHERE id = p_ticket_id;
    END IF;
  END IF;

  -- ── Query all overdue/partial entries for this tenant ──
  SELECT
    COUNT(*),
    COALESCE(SUM(amount_due - COALESCE(amount_paid, 0)), 0),
    bool_or(status = 'partial')
  INTO v_months_overdue, v_total_arrears, v_has_partial
  FROM c1_rent_ledger
  WHERE tenant_id = p_ticket.tenant_id
    AND status IN ('overdue', 'partial');

  -- No overdue entries remain → cleared
  IF v_months_overdue = 0 OR v_total_arrears <= 0 THEN
    RETURN QUERY SELECT 'completed'::text, 'rent_cleared'::text;
    RETURN;
  END IF;

  -- Partial payment exists
  IF v_has_partial THEN
    RETURN QUERY SELECT 'needs_attention'::text, 'rent_partial_payment'::text;
    RETURN;
  END IF;

  -- All overdue
  RETURN QUERY SELECT 'needs_attention'::text, 'rent_overdue'::text;
END;
$$;


-- ─── 3. get_rent_reminders_due (not protected) ────────────────────────
-- Must DROP first: adding property_id changes RETURNS TABLE signature,
-- which CREATE OR REPLACE cannot do.

DROP FUNCTION IF EXISTS public.get_rent_reminders_due();

CREATE OR REPLACE FUNCTION public.get_rent_reminders_due()
RETURNS TABLE (
  ledger_id uuid,
  room_id uuid,
  tenant_id uuid,
  property_manager_id uuid,
  property_id uuid,
  due_date date,
  amount_due numeric,
  amount_paid numeric,
  status text,
  reminder_level integer,
  tenant_name text,
  tenant_phone text,
  property_address text,
  room_number text
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  -- Reminder 1: 3 days before due date
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    r.property_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    1 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE + 3
    AND rl.reminder_1_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  UNION ALL

  -- Reminder 2: on due date (unpaid)
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    r.property_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    2 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE
    AND rl.reminder_2_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  UNION ALL

  -- Reminder 3: 3 days overdue (unpaid)
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    r.property_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    3 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date = CURRENT_DATE - 3
    AND rl.reminder_3_sent_at IS NULL
    AND rl.status NOT IN ('paid', 'cancelled')

  UNION ALL

  -- Overdue entries for ticket creation/updates (day 1+)
  -- No NOT EXISTS guard: entries with existing tickets still returned
  -- so the edge function can update title/description/priority via dedup.
  SELECT
    rl.id AS ledger_id,
    rl.room_id,
    rl.tenant_id,
    rl.property_manager_id,
    r.property_id,
    rl.due_date,
    rl.amount_due,
    rl.amount_paid,
    rl.status,
    0 AS reminder_level,
    t.full_name AS tenant_name,
    t.phone AS tenant_phone,
    p.address AS property_address,
    r.room_number
  FROM c1_rent_ledger rl
  JOIN c1_tenants t ON t.id = rl.tenant_id
  JOIN c1_rooms r ON r.id = rl.room_id
  JOIN c1_properties p ON p.id = r.property_id
  WHERE rl.due_date < CURRENT_DATE
    AND rl.due_date >= CURRENT_DATE - interval '90 days'
    AND rl.status NOT IN ('paid', 'cancelled')

  ORDER BY due_date ASC, reminder_level ASC;
$$;


-- ─── 4. c1_get_dashboard_todo_extras (not protected) — remove rent ────

CREATE OR REPLACE FUNCTION public.c1_get_dashboard_todo_extras(p_pm_id uuid)
RETURNS SETOF jsonb
LANGUAGE plpgsql
STABLE SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY

  -- ─── 1. Compliance: certs that are expired, expiring, or incomplete ───
  WITH compliance_items AS (
    SELECT
      cc.id AS entity_id,
      cc.property_id,
      p.address AS property_label,
      cc.certificate_type,
      cc.expiry_date,
      cc.document_url,
      CASE cc.certificate_type
        WHEN 'hmo_license'  THEN 'HMO Licence'
        WHEN 'gas_safety'   THEN 'Gas Safety (CP12)'
        WHEN 'eicr'         THEN 'EICR'
        WHEN 'epc'          THEN 'EPC'
        WHEN 'fire_risk'    THEN 'Fire Risk Assessment'
        WHEN 'pat'          THEN 'PAT Testing'
        WHEN 'legionella'   THEN 'Legionella Risk Assessment'
        WHEN 'smoke_alarms' THEN 'Smoke Alarms'
        WHEN 'co_alarms'    THEN 'CO Alarms'
        ELSE cc.certificate_type::text
      END AS cert_label,
      CASE
        WHEN cc.document_url IS NULL OR cc.expiry_date IS NULL THEN 'compliance_incomplete'
        WHEN cc.expiry_date < CURRENT_DATE THEN 'compliance_expired'
        WHEN cc.expiry_date <= CURRENT_DATE + interval '7 days' THEN 'compliance_expiring'
        WHEN cc.expiry_date <= CURRENT_DATE + interval '14 days' THEN 'compliance_expiring'
        WHEN cc.expiry_date <= CURRENT_DATE + interval '30 days' THEN 'compliance_expiring'
      END AS reason_key,
      CASE
        WHEN cc.document_url IS NULL OR cc.expiry_date IS NULL THEN 100
        WHEN cc.expiry_date < CURRENT_DATE THEN 180
        WHEN cc.expiry_date <= CURRENT_DATE + interval '7 days' THEN 150
        WHEN cc.expiry_date <= CURRENT_DATE + interval '14 days' THEN 120
        WHEN cc.expiry_date <= CURRENT_DATE + interval '30 days' THEN 80
      END AS priority_score,
      CASE
        WHEN cc.document_url IS NULL OR cc.expiry_date IS NULL THEN 'HIGH'
        WHEN cc.expiry_date < CURRENT_DATE THEN 'URGENT'
        WHEN cc.expiry_date <= CURRENT_DATE + interval '7 days' THEN 'URGENT'
        WHEN cc.expiry_date <= CURRENT_DATE + interval '14 days' THEN 'HIGH'
        ELSE 'NORMAL'
      END AS priority_bucket
    FROM c1_compliance_certificates cc
    JOIN c1_properties p ON p.id = cc.property_id
    LEFT JOIN c1_tickets t
      ON t.compliance_certificate_id = cc.id
      AND t.status = 'open'
      AND (t.archived IS NULL OR t.archived = false)
    WHERE (cc.property_manager_id = p_pm_id
           OR (cc.property_manager_id IS NULL AND p.property_manager_id = p_pm_id))
      AND (
        cc.document_url IS NULL
        OR cc.expiry_date IS NULL
        OR cc.expiry_date <= CURRENT_DATE + interval '30 days'
      )
      AND t.id IS NULL
  ),

  -- ─── 2. Tenancy: ending soon or already expired ───
  tenancy_items AS (
    SELECT
      r.id AS entity_id,
      r.property_id,
      p.address AS property_label,
      r.room_number,
      t.full_name AS tenant_name,
      r.tenancy_end_date,
      CASE
        WHEN r.tenancy_end_date < CURRENT_DATE THEN 'tenancy_expired'
        ELSE 'tenancy_ending'
      END AS reason_key,
      CASE
        WHEN r.tenancy_end_date < CURRENT_DATE THEN 100
        ELSE 70
      END AS priority_score,
      CASE
        WHEN r.tenancy_end_date < CURRENT_DATE THEN 'HIGH'
        ELSE 'NORMAL'
      END AS priority_bucket
    FROM c1_rooms r
    JOIN c1_properties p ON p.id = r.property_id
    LEFT JOIN c1_tenants t ON t.id = r.current_tenant_id
    WHERE r.property_manager_id = p_pm_id
      AND r.current_tenant_id IS NOT NULL
      AND r.tenancy_end_date IS NOT NULL
      AND r.tenancy_end_date <= CURRENT_DATE + interval '30 days'
  ),

  -- ─── 3. Handoff: open conversations without tickets ───
  handoff_items AS (
    SELECT
      c.id AS entity_id,
      c.property_id,
      COALESCE(p.address, 'Unknown property') AS property_label,
      COALESCE(c.caller_name, c.phone, 'Unknown caller') AS caller_label,
      c.last_updated
    FROM c1_conversations c
    LEFT JOIN c1_properties p ON p.id = c.property_id
    WHERE c.property_manager_id = p_pm_id
      AND c.handoff = true
      AND c.status = 'open'
      AND NOT EXISTS (
        SELECT 1 FROM c1_tickets tk WHERE tk.conversation_id = c.id
      )
  )

  -- ═══ UNION ALL: emit JSONB rows ═══

  -- Compliance items (expired, expiring, incomplete)
  SELECT jsonb_build_object(
    'id',                  'compliance_' || ci.entity_id::text,
    'ticket_id',           ci.entity_id,
    'source_type',         'compliance',
    'entity_id',           ci.entity_id,
    'property_id',         ci.property_id,
    'property_label',      COALESCE(ci.property_label, 'Unknown property'),
    'issue_summary',       CASE
                             WHEN ci.reason_key = 'compliance_incomplete'
                               THEN ci.cert_label || ' — missing details'
                             WHEN ci.reason_key = 'compliance_expired'
                               THEN ci.cert_label || ' expired ' || (CURRENT_DATE - ci.expiry_date) || ' days ago'
                             ELSE ci.cert_label || ' expires in ' || (ci.expiry_date - CURRENT_DATE) || ' days'
                           END,
    'action_type',         CASE
                             WHEN ci.reason_key IN ('compliance_expired', 'compliance_incomplete') THEN 'NEEDS_ATTENTION'
                             ELSE 'FOLLOW_UP'
                           END,
    'action_label',        CASE
                             WHEN ci.reason_key = 'compliance_incomplete' THEN 'Complete ' || ci.cert_label
                             WHEN ci.reason_key = 'compliance_expired' THEN ci.cert_label || ' expired'
                             ELSE ci.cert_label || ' expiring'
                           END,
    'action_context',      CASE
                             WHEN ci.reason_key = 'compliance_incomplete'
                               THEN ci.cert_label || ' at ' || COALESCE(ci.property_label, 'unknown') || ' — add expiry date and document'
                             WHEN ci.reason_key = 'compliance_expired'
                               THEN ci.cert_label || ' expired ' || (CURRENT_DATE - ci.expiry_date) || ' days ago at ' || COALESCE(ci.property_label, 'unknown')
                             ELSE ci.cert_label || ' expires in ' || (ci.expiry_date - CURRENT_DATE) || ' days at ' || COALESCE(ci.property_label, 'unknown')
                           END,
    'next_action_reason',  ci.reason_key,
    'priority',            CASE
                             WHEN ci.reason_key = 'compliance_expired' THEN 'Urgent'
                             WHEN ci.priority_bucket = 'URGENT' THEN 'Urgent'
                             WHEN ci.priority_bucket = 'HIGH' THEN 'High'
                             ELSE 'Medium'
                           END,
    'priority_score',      ci.priority_score,
    'priority_bucket',     ci.priority_bucket,
    'waiting_since',       COALESCE(ci.expiry_date, CURRENT_DATE),
    'sla_breached',        ci.reason_key = 'compliance_expired',
    'created_at',          COALESCE(ci.expiry_date, CURRENT_DATE)
  )
  FROM compliance_items ci

  UNION ALL

  -- Tenancy: ending soon or expired
  SELECT jsonb_build_object(
    'id',                  'tenancy_' || ti.entity_id::text,
    'ticket_id',           ti.entity_id,
    'source_type',         'tenancy',
    'entity_id',           ti.entity_id,
    'property_id',         ti.property_id,
    'property_label',      COALESCE(ti.property_label, 'Unknown property'),
    'issue_summary',       CASE
                             WHEN ti.reason_key = 'tenancy_expired'
                               THEN COALESCE(ti.tenant_name, 'Tenant') || ', Room ' || ti.room_number || ' — ended ' || (CURRENT_DATE - ti.tenancy_end_date) || ' days ago'
                             ELSE COALESCE(ti.tenant_name, 'Tenant') || ', Room ' || ti.room_number || ' — ends ' || to_char(ti.tenancy_end_date, 'DD Mon')
                           END,
    'action_type',         CASE WHEN ti.reason_key = 'tenancy_expired' THEN 'NEEDS_ATTENTION' ELSE 'FOLLOW_UP' END,
    'action_label',        CASE WHEN ti.reason_key = 'tenancy_expired' THEN 'Tenancy expired' ELSE 'Tenancy ending' END,
    'action_context',      CASE
                             WHEN ti.reason_key = 'tenancy_expired'
                               THEN 'Tenancy ended ' || (CURRENT_DATE - ti.tenancy_end_date) || ' days ago — update room status'
                             ELSE 'Tenancy ends ' || to_char(ti.tenancy_end_date, 'DD Mon YYYY') || ' — review renewal or void'
                           END,
    'next_action_reason',  ti.reason_key,
    'priority',            NULL,
    'priority_score',      ti.priority_score,
    'priority_bucket',     ti.priority_bucket,
    'waiting_since',       ti.tenancy_end_date,
    'sla_breached',        ti.reason_key = 'tenancy_expired',
    'created_at',          ti.tenancy_end_date
  )
  FROM tenancy_items ti

  UNION ALL

  -- Handoff: open conversations without tickets
  SELECT jsonb_build_object(
    'id',                  'handoff_' || hi.entity_id::text,
    'ticket_id',           hi.entity_id,
    'source_type',         'handoff',
    'entity_id',           hi.entity_id,
    'property_id',         hi.property_id,
    'property_label',      hi.property_label,
    'issue_summary',       hi.caller_label || ' called about ' || hi.property_label || ' — needs ticket',
    'action_type',         'NEEDS_ATTENTION',
    'action_label',        'Handoff conversation',
    'action_context',      hi.caller_label || ' called about ' || hi.property_label || ' — create a ticket to dispatch',
    'next_action_reason',  'handoff_conversation',
    'priority',            NULL,
    'priority_score',      130,
    'priority_bucket',     'HIGH',
    'waiting_since',       hi.last_updated,
    'sla_breached',        false,
    'created_at',          hi.last_updated
  )
  FROM handoff_items hi;

END;
$function$;


-- ─── 5. c1_get_dashboard_todo (PROTECTED) — add rent labels ───────────

CREATE OR REPLACE FUNCTION public.c1_get_dashboard_todo(p_pm_id uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
  -- Pre-filter: only this PM's open, non-archived, non-held tickets
  WITH pm_tickets AS (
    SELECT t.id
    FROM c1_tickets t
    WHERE t.property_manager_id = p_pm_id
      AND lower(t.status) != 'closed'
      AND COALESCE(t.archived, false) = false
      AND COALESCE(t.on_hold, false) = false
  ),
  contractor_timing AS (
    SELECT
      m.ticket_id,
      bool_or(
        (c->>'status') = 'sent'
        AND (c->>'sent_at') IS NOT NULL
        AND (c->>'sent_at')::timestamptz < now() - interval '48 hours'
      ) AS has_unresponsive
    FROM c1_messages m
    JOIN pm_tickets pt ON pt.id = m.ticket_id
    CROSS JOIN jsonb_array_elements(COALESCE(m.contractors, '[]'::jsonb)) AS c
    WHERE m.stage = 'waiting_contractor'
    GROUP BY m.ticket_id
  ),
  scored AS (
    SELECT
      t.id,
      t.property_manager_id,
      t.category,
      t.property_id,
      t.compliance_certificate_id,
      p.address AS property_label,
      COALESCE(t.issue_title, LEFT(t.issue_description, 100)) AS issue_summary,
      t.next_action_reason,
      t.priority,
      t.sla_due_at,
      t.date_logged,
      COALESCE(m.updated_at, t.date_logged) AS waiting_since,
      COALESCE(ct.has_unresponsive, false) AS has_unresponsive,

      CASE
        WHEN t.next_action_reason IN ('handoff_review','landlord_declined','job_not_completed','pending_review','ooh_dispatched','ooh_resolved','ooh_unresolved','landlord_needs_help','landlord_resolved') THEN 'NEEDS_ATTENTION'
        WHEN t.next_action_reason IN ('rent_overdue','rent_partial_payment') THEN 'NEEDS_ATTENTION'
        WHEN t.next_action_reason = 'no_contractors' THEN 'ASSIGN_CONTRACTOR'
        WHEN t.next_action_reason IN ('manager_approval','awaiting_landlord') THEN 'AWAITING_APPROVAL'
        WHEN t.next_action_reason = 'awaiting_contractor' AND COALESCE(ct.has_unresponsive, false) THEN 'CONTRACTOR_UNRESPONSIVE'
        ELSE 'FOLLOW_UP'
      END AS action_type,

      CASE
        WHEN t.next_action_reason = 'rent_overdue' THEN 'Rent overdue'
        WHEN t.next_action_reason = 'rent_partial_payment' THEN 'Partial payment'
        WHEN t.next_action_reason = 'ooh_dispatched' THEN 'OOH dispatched'
        WHEN t.next_action_reason = 'ooh_resolved' THEN 'OOH resolved'
        WHEN t.next_action_reason = 'ooh_unresolved' THEN 'OOH unresolved'
        WHEN t.next_action_reason = 'ooh_in_progress' THEN 'OOH in progress'
        WHEN t.next_action_reason = 'allocated_to_landlord' THEN 'Landlord managing'
        WHEN t.next_action_reason = 'landlord_in_progress' THEN 'Landlord in progress'
        WHEN t.next_action_reason = 'landlord_resolved' THEN 'Landlord resolved'
        WHEN t.next_action_reason = 'landlord_needs_help' THEN 'Landlord needs help'
        WHEN t.next_action_reason = 'pending_review' THEN 'Review issue'
        WHEN t.next_action_reason = 'handoff_review' THEN 'Needs attention'
        WHEN t.next_action_reason = 'landlord_declined' THEN 'Landlord declined'
        WHEN t.next_action_reason = 'job_not_completed' THEN 'Job not completed'
        WHEN t.next_action_reason = 'no_contractors' THEN 'Assign contractor'
        WHEN t.next_action_reason = 'manager_approval' THEN 'Review quote'
        WHEN t.next_action_reason = 'awaiting_landlord' THEN 'Awaiting landlord'
        WHEN t.next_action_reason = 'awaiting_contractor' AND COALESCE(ct.has_unresponsive, false) THEN 'Contractor unresponsive'
        WHEN t.next_action_reason = 'awaiting_contractor' THEN 'Awaiting contractor'
        WHEN t.next_action_reason = 'awaiting_booking' THEN 'Awaiting booking'
        WHEN t.next_action_reason = 'scheduled' THEN 'Job scheduled'
        ELSE 'Follow up'
      END AS action_label,

      CASE
        WHEN t.next_action_reason = 'rent_overdue' THEN 'Tenant has overdue rent — chase payment'
        WHEN t.next_action_reason = 'rent_partial_payment' THEN 'Partial payment received — follow up for remainder'
        WHEN t.next_action_reason = 'ooh_dispatched' THEN 'Emergency dispatched to OOH contact — awaiting response'
        WHEN t.next_action_reason = 'ooh_resolved' THEN 'OOH contact handled the issue — review and mark complete'
        WHEN t.next_action_reason = 'ooh_unresolved' THEN 'OOH contact could not resolve — needs follow-up'
        WHEN t.next_action_reason = 'ooh_in_progress' THEN 'OOH contact is working on it'
        WHEN t.next_action_reason = 'allocated_to_landlord' THEN 'Issue allocated to landlord — awaiting response'
        WHEN t.next_action_reason = 'landlord_in_progress' THEN 'Landlord is working on it'
        WHEN t.next_action_reason = 'landlord_resolved' THEN 'Landlord resolved the issue — review and mark complete'
        WHEN t.next_action_reason = 'landlord_needs_help' THEN 'Landlord needs help — take over or assist'
        WHEN t.next_action_reason = 'pending_review' THEN 'New ticket awaiting triage'
        WHEN t.next_action_reason = 'handoff_review' THEN 'Ticket requires manual review'
        WHEN t.next_action_reason = 'landlord_declined' THEN 'Landlord declined the quote'
        WHEN t.next_action_reason = 'job_not_completed' THEN 'Job was marked incomplete'
        WHEN t.next_action_reason = 'no_contractors' THEN 'All contractors exhausted — add a new one'
        WHEN t.next_action_reason = 'manager_approval' THEN 'Contractor quote needs your approval'
        WHEN t.next_action_reason = 'awaiting_landlord' THEN 'Waiting for landlord to approve the quote'
        WHEN t.next_action_reason = 'awaiting_contractor' AND COALESCE(ct.has_unresponsive, false) THEN 'Contractor has not responded for 48+ hours'
        WHEN t.next_action_reason = 'awaiting_contractor' THEN 'Waiting for contractor response'
        WHEN t.next_action_reason = 'awaiting_booking' THEN 'Contractor needs to confirm a date'
        WHEN t.next_action_reason = 'scheduled' THEN 'Job is scheduled — awaiting completion'
        ELSE 'Ticket needs follow-up'
      END AS action_context,

      (
        CASE t.priority
          WHEN 'Emergency' THEN 100 WHEN 'Urgent' THEN 75
          WHEN 'High' THEN 50 WHEN 'Medium' THEN 25 WHEN 'Low' THEN 10 ELSE 25
        END
        + CASE
          WHEN t.next_action_reason IN ('handoff_review','landlord_declined','job_not_completed','pending_review') THEN 30
          WHEN t.next_action_reason IN ('no_contractors','ooh_dispatched','ooh_unresolved','landlord_needs_help') THEN 25
          WHEN t.next_action_reason IN ('rent_overdue','rent_partial_payment') THEN 25
          WHEN t.next_action_reason IN ('ooh_resolved','landlord_resolved') THEN 20
          WHEN t.next_action_reason = 'awaiting_contractor' AND COALESCE(ct.has_unresponsive, false) THEN 25
          WHEN t.next_action_reason IN ('manager_approval','awaiting_landlord') THEN 10
          WHEN t.next_action_reason IN ('ooh_in_progress','allocated_to_landlord','landlord_in_progress') THEN 5
          ELSE 5
        END
        + CASE WHEN t.sla_due_at IS NOT NULL AND t.sla_due_at < now() THEN 50 ELSE 0 END
        + LEAST(EXTRACT(EPOCH FROM (now() - COALESCE(m.updated_at, t.date_logged))) / 3600, 48)::int
      ) AS priority_score,

      CASE
        WHEN t.priority = 'Emergency' OR (t.sla_due_at IS NOT NULL AND t.sla_due_at < now()) THEN 'URGENT'
        WHEN t.priority = 'Urgent' THEN 'URGENT'
        WHEN t.priority = 'High' THEN 'HIGH'
        WHEN t.priority = 'Low' THEN 'LOW'
        ELSE 'NORMAL'
      END AS priority_bucket

    FROM c1_tickets t
    JOIN pm_tickets pt ON pt.id = t.id
    JOIN c1_properties p ON p.id = t.property_id
    LEFT JOIN c1_messages m ON m.ticket_id = t.id
    LEFT JOIN contractor_timing ct ON ct.ticket_id = t.id
  )
  SELECT jsonb_build_object(
    'id', 'todo_' || s.id::text,
    'ticket_id', s.id,
    'source_type', CASE
      WHEN s.category = 'compliance_renewal' THEN 'compliance'
      WHEN s.category = 'rent_arrears' THEN 'rent'
      ELSE 'ticket'
    END,
    'entity_id', CASE
      WHEN s.compliance_certificate_id IS NOT NULL THEN s.compliance_certificate_id
      ELSE s.id
    END,
    'property_id', s.property_id,
    'portfolio_id', s.property_manager_id,
    'property_label', s.property_label,
    'issue_summary', s.issue_summary,
    'action_type', s.action_type,
    'action_label', s.action_label,
    'action_context', s.action_context,
    'next_action_reason', s.next_action_reason,
    'priority', s.priority,
    'priority_score', s.priority_score,
    'priority_bucket', s.priority_bucket,
    'waiting_since', s.waiting_since,
    'sla_breached', CASE WHEN s.category IN ('rent_arrears', 'compliance_renewal') THEN false ELSE COALESCE(s.sla_due_at < now(), false) END,
    'sla_due_at', CASE WHEN s.category IN ('rent_arrears', 'compliance_renewal') THEN NULL ELSE s.sla_due_at END,
    'created_at', s.date_logged
  )
  FROM scored s
  ORDER BY s.priority_score DESC, s.waiting_since ASC;
END;
$function$;


-- ─── 6. One-time data fix: normalize existing rent ticket titles ──────
-- Fixes tickets created before the title format change.
-- New format: "{tenant_name} owes £{amount}"

UPDATE c1_tickets t
SET issue_title = COALESCE(ten.full_name, 'Unknown tenant') || ' owes £' ||
    TRIM(to_char(
      COALESCE((SELECT SUM(rl.amount_due - COALESCE(rl.amount_paid, 0))
       FROM c1_rent_ledger rl
       WHERE rl.tenant_id = t.tenant_id
         AND rl.status IN ('overdue', 'partial')), 0),
      'FM999999990.00'))
FROM c1_tenants ten
WHERE ten.id = t.tenant_id
  AND t.category = 'rent_arrears'
  AND t.status = 'open';
