-- ============================================================
-- Contractor Compliance Portal
--
-- 1. Extends c1_get_contractor_ticket (PROTECTED — approved)
--    to return compliance_certificate_id + cert info
-- 2. New RPC: compliance_submit_contractor_renewal
--    Contractor uploads renewed cert via portal
-- ============================================================

-- ─── 1. Extend c1_get_contractor_ticket (PROTECTED) ───────────
-- Adding compliance_certificate_id, compliance_cert_type, compliance_expiry_date
-- to the returned jsonb. Existing keys unchanged.

CREATE OR REPLACE FUNCTION public.c1_get_contractor_ticket(p_token text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
DECLARE
  v_result jsonb;
BEGIN
  SELECT jsonb_build_object(
    'ticket_id', t.id,
    'ticket_ref', split_part(t.id::text, '-', 1),
    'property_address', p.address,
    'issue_title', t.issue_title,
    'issue_description', t.issue_description,
    'category', t.category,
    'priority', t.priority,
    'images', COALESCE(t.images, '[]'::jsonb),
    'availability', t.availability,
    'date_logged', t.date_logged,
    'status', t.status,
    'job_stage', t.job_stage,
    'contractor_quote', t.contractor_quote,
    'final_amount', t.final_amount,
    'scheduled_date', t.scheduled_date,
    'tenant_name', ten.full_name,
    'tenant_phone', ten.phone,
    'business_name', pm.business_name,
    'contractor_name', c.contractor_name,
    'reschedule_requested', COALESCE(t.reschedule_requested, false),
    'reschedule_date', t.reschedule_date,
    'reschedule_reason', t.reschedule_reason,
    'reschedule_status', t.reschedule_status,
    'resolved_at', t.resolved_at,
    'tenant_updates', COALESCE(t.tenant_updates, '[]'::jsonb),
    'min_booking_lead_hours', COALESCE(pm.min_booking_lead_hours, 3),
    -- Compliance fields (null for maintenance tickets)
    'compliance_certificate_id', t.compliance_certificate_id,
    'compliance_cert_type', cert.certificate_type::text,
    'compliance_expiry_date', cert.expiry_date
  ) INTO v_result
  FROM c1_tickets t
  JOIN c1_properties p ON p.id = t.property_id
  JOIN c1_property_managers pm ON pm.id = t.property_manager_id
  LEFT JOIN c1_tenants ten ON ten.id = t.tenant_id
  LEFT JOIN c1_contractors c ON c.id = t.contractor_id
  LEFT JOIN c1_compliance_certificates cert ON cert.id = t.compliance_certificate_id
  WHERE t.contractor_token = p_token;

  IF v_result IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired link';
  END IF;

  RETURN v_result;
END;
$function$;

-- ─── 2. New RPC: compliance_submit_contractor_renewal ──────────
-- Contractor uploads renewed cert. Both updates are atomic
-- (single function = single transaction).

CREATE OR REPLACE FUNCTION public.compliance_submit_contractor_renewal(
  p_token text,
  p_document_url text,
  p_expiry_date date,
  p_issued_by text DEFAULT NULL,
  p_certificate_number text DEFAULT NULL,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_ticket_id uuid;
  v_cert_id uuid;
BEGIN
  -- Validate token and get ticket + cert linkage
  SELECT t.id, t.compliance_certificate_id
  INTO v_ticket_id, v_cert_id
  FROM c1_tickets t
  WHERE t.contractor_token = p_token;

  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired link';
  END IF;

  IF v_cert_id IS NULL THEN
    RAISE EXCEPTION 'This ticket is not linked to a compliance certificate';
  END IF;

  -- Update cert record with new data + reset reminders
  UPDATE c1_compliance_certificates SET
    document_url = p_document_url,
    expiry_date = p_expiry_date,
    issued_by = COALESCE(p_issued_by, issued_by),
    certificate_number = COALESCE(p_certificate_number, certificate_number),
    notes = COALESCE(p_notes, notes),
    reminder_count = 0,
    last_reminder_at = NULL,
    reminder_sent_at = NULL,
    updated_at = now()
  WHERE id = v_cert_id;

  -- Close the ticket
  UPDATE c1_tickets SET
    job_stage = 'completed',
    resolved_at = now(),
    next_action_reason = 'completed',
    tenant_updates = COALESCE(tenant_updates, '[]'::jsonb) || jsonb_build_object(
      'type', 'compliance_renewal_completed',
      'document_url', p_document_url,
      'expiry_date', p_expiry_date::text,
      'issued_by', p_issued_by,
      'certificate_number', p_certificate_number,
      'notes', p_notes,
      'submitted_at', now()
    ),
    updated_at = now()
  WHERE id = v_ticket_id;

  RETURN jsonb_build_object(
    'success', true,
    'ticket_id', v_ticket_id,
    'cert_id', v_cert_id
  );
END;
$$;
