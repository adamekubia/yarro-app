-- =============================================================
-- Fix: compliance_upsert_certificate — resilient auto-close
--
-- Wraps the auto-close ticket UPDATE in a sub-block so that
-- trigger/cascade errors from the ticket system cannot abort
-- the certificate insert. Also adds RAISE NOTICE on failure
-- for observability.
-- =============================================================

CREATE OR REPLACE FUNCTION public.compliance_upsert_certificate(
  p_property_id uuid,
  p_pm_id uuid,
  p_certificate_type text,
  p_issued_date date DEFAULT NULL,
  p_expiry_date date DEFAULT NULL,
  p_certificate_number text DEFAULT NULL,
  p_issued_by text DEFAULT NULL,
  p_notes text DEFAULT NULL,
  p_reminder_days_before integer DEFAULT 60,
  p_contractor_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_new_id uuid;
BEGIN
  -- Auto-close any open compliance ticket linked to the cert being replaced.
  -- Wrapped in sub-block: if ticket triggers/cascades error, cert insert still succeeds.
  BEGIN
    UPDATE public.c1_tickets
    SET status = 'closed',
        resolved_at = now(),
        tenant_updates = COALESCE(tenant_updates, '[]'::jsonb) || jsonb_build_object(
          'type', 'compliance_manual_renewal', 'at', now()
        )
    WHERE compliance_certificate_id IN (
      SELECT id FROM public.c1_compliance_certificates
      WHERE property_id = p_property_id
        AND property_manager_id = p_pm_id
        AND certificate_type = p_certificate_type::public.certificate_type
    )
    AND status = 'open';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'compliance_upsert_certificate: auto-close failed (%), continuing', SQLERRM;
  END;

  DELETE FROM c1_compliance_certificates
  WHERE property_id = p_property_id
    AND property_manager_id = p_pm_id
    AND certificate_type = p_certificate_type::public.certificate_type;

  INSERT INTO c1_compliance_certificates (
    property_id, property_manager_id, certificate_type,
    issued_date, expiry_date, certificate_number, issued_by, notes,
    status, reminder_days_before, contractor_id
  ) VALUES (
    p_property_id, p_pm_id, p_certificate_type::public.certificate_type,
    p_issued_date, p_expiry_date, p_certificate_number, p_issued_by, p_notes,
    'valid', p_reminder_days_before, p_contractor_id
  )
  RETURNING id INTO v_new_id;

  RETURN v_new_id;
END;
$$;
