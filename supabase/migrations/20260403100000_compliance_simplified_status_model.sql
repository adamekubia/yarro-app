-- ============================================================
-- Compliance Simplified Status Model
--
-- Removes 'review' status entirely. Document + expiry = valid.
-- No manual verification step. 4 statuses + renewal_scheduled overlay.
--
-- Status logic (applied uniformly in all RPCs):
--   missing:           no cert, OR no document_url, OR no expiry_date
--   renewal_scheduled: has active renewal ticket (overlay)
--   expired:           has doc + expiry < today
--   expiring_soon:     has doc + expiry < today + 30 days
--   valid:             has doc + expiry >= today + 30 days
--
-- Also adds multi-reminder support:
--   reminder_count (0-3) + last_reminder_at replace reminder_sent_at
-- ============================================================

-- ─── 1. Add multi-reminder columns ────────────────────────────
ALTER TABLE public.c1_compliance_certificates
  ADD COLUMN IF NOT EXISTS reminder_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS last_reminder_at timestamptz;

-- ─── 2. Migrate existing reminder_sent_at data ────────────────
UPDATE public.c1_compliance_certificates
SET reminder_count = 1, last_reminder_at = reminder_sent_at
WHERE reminder_sent_at IS NOT NULL;

-- ─── 3. Rewrite compliance_get_all_statuses (SSOT) ────────────
CREATE OR REPLACE FUNCTION public.compliance_get_all_statuses(
  p_pm_id uuid
)
RETURNS TABLE (
  cert_id uuid,
  property_id uuid,
  property_address text,
  certificate_type text,
  display_status text,
  expiry_date date,
  days_remaining integer,
  issued_date date,
  issued_by text,
  certificate_number text,
  document_url text,
  renewal_ticket_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    cert.id AS cert_id,
    req.property_id,
    p.address AS property_address,
    req.certificate_type::text,
    CASE
      WHEN cert.id IS NULL THEN 'missing'
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 'missing'
      WHEN t.id IS NOT NULL THEN 'renewal_scheduled'
      WHEN cert.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 'expiring_soon'
      ELSE 'valid'
    END AS display_status,
    cert.expiry_date,
    CASE
      WHEN cert.expiry_date IS NOT NULL THEN (cert.expiry_date - CURRENT_DATE)::integer
      ELSE NULL
    END AS days_remaining,
    cert.issued_date,
    cert.issued_by,
    cert.certificate_number,
    cert.document_url,
    t.id AS renewal_ticket_id
  FROM c1_compliance_requirements req
  JOIN c1_properties p ON p.id = req.property_id
  LEFT JOIN c1_compliance_certificates cert
    ON cert.property_id = req.property_id
    AND cert.certificate_type = req.certificate_type
    AND cert.property_manager_id = req.property_manager_id
  LEFT JOIN c1_tickets t
    ON t.compliance_certificate_id = cert.id
    AND t.status = 'open'
    AND t.archived = false
  WHERE req.property_manager_id = p_pm_id
    AND req.is_required = true
  ORDER BY
    CASE
      WHEN cert.id IS NULL THEN 1
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 2
      WHEN cert.expiry_date < CURRENT_DATE THEN 3
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 4
      ELSE 5
    END,
    cert.expiry_date ASC NULLS FIRST;
$$;

-- ─── 4. Rewrite compliance_get_property_status ─────────────────
CREATE OR REPLACE FUNCTION public.compliance_get_property_status(
  p_property_id uuid,
  p_pm_id uuid
)
RETURNS TABLE (
  certificate_type text,
  display_status text,
  expiry_date date,
  days_remaining integer,
  cert_id uuid,
  issued_by text,
  certificate_number text,
  document_url text,
  renewal_ticket_id uuid,
  reminder_days_before integer,
  contractor_id uuid
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    req.certificate_type::text,
    CASE
      WHEN cert.id IS NULL THEN 'missing'
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 'missing'
      WHEN t.id IS NOT NULL THEN 'renewal_scheduled'
      WHEN cert.expiry_date < CURRENT_DATE THEN 'expired'
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 'expiring_soon'
      ELSE 'valid'
    END AS display_status,
    cert.expiry_date,
    CASE
      WHEN cert.expiry_date IS NOT NULL THEN (cert.expiry_date - CURRENT_DATE)::integer
      ELSE NULL
    END AS days_remaining,
    cert.id AS cert_id,
    cert.issued_by,
    cert.certificate_number,
    cert.document_url,
    t.id AS renewal_ticket_id,
    cert.reminder_days_before,
    cert.contractor_id
  FROM c1_compliance_requirements req
  LEFT JOIN c1_compliance_certificates cert
    ON cert.property_id = req.property_id
    AND cert.certificate_type = req.certificate_type
    AND cert.property_manager_id = req.property_manager_id
  LEFT JOIN c1_tickets t
    ON t.compliance_certificate_id = cert.id
    AND t.status = 'open'
    AND t.archived = false
  WHERE req.property_id = p_property_id
    AND req.property_manager_id = p_pm_id
    AND req.is_required = true
  ORDER BY
    CASE
      WHEN cert.id IS NULL THEN 1
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 2
      WHEN cert.expiry_date < CURRENT_DATE THEN 3
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 4
      ELSE 5
    END,
    cert.expiry_date ASC NULLS FIRST;
$$;

-- ─── 5. Rewrite compliance_get_todos ───────────────────────────
-- Removed 'verify' action. Missing = obtain, expired = renew, expiring = schedule.
CREATE OR REPLACE FUNCTION public.compliance_get_todos(
  p_pm_id uuid
)
RETURNS TABLE (
  property_address text,
  property_id uuid,
  cert_type text,
  cert_id uuid,
  action text,
  urgency_label text,
  days_remaining integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    p.address AS property_address,
    req.property_id,
    req.certificate_type::text AS cert_type,
    cert.id AS cert_id,
    CASE
      WHEN cert.id IS NULL THEN 'obtain'
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 'obtain'
      WHEN cert.expiry_date < CURRENT_DATE THEN 'renew'
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 'schedule_renewal'
      ELSE NULL
    END AS action,
    CASE
      WHEN cert.id IS NULL THEN 'Missing'
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 'Missing'
      WHEN cert.expiry_date < CURRENT_DATE THEN
        'Expired ' || abs((cert.expiry_date - CURRENT_DATE)::integer) || ' days ago'
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN
        'Expires in ' || (cert.expiry_date - CURRENT_DATE)::integer || ' days'
      ELSE NULL
    END AS urgency_label,
    CASE
      WHEN cert.expiry_date IS NOT NULL THEN (cert.expiry_date - CURRENT_DATE)::integer
      ELSE NULL
    END AS days_remaining
  FROM c1_compliance_requirements req
  JOIN c1_properties p ON p.id = req.property_id
  LEFT JOIN c1_compliance_certificates cert
    ON cert.property_id = req.property_id
    AND cert.certificate_type = req.certificate_type
    AND cert.property_manager_id = req.property_manager_id
  LEFT JOIN c1_tickets t
    ON t.compliance_certificate_id = cert.id
    AND t.status = 'open'
    AND t.archived = false
  WHERE req.property_manager_id = p_pm_id
    AND req.is_required = true
    -- Exclude valid certs (have doc + expiry >= 30 days)
    AND NOT (
      cert.id IS NOT NULL
      AND cert.document_url IS NOT NULL
      AND cert.expiry_date IS NOT NULL
      AND cert.expiry_date >= CURRENT_DATE + interval '30 days'
    )
    -- Exclude certs with active renewal tickets
    AND t.id IS NULL
  ORDER BY
    CASE
      WHEN cert.id IS NULL THEN 4
      WHEN cert.document_url IS NULL OR cert.expiry_date IS NULL THEN 4
      WHEN cert.expiry_date < CURRENT_DATE THEN 1
      WHEN cert.expiry_date < CURRENT_DATE + interval '30 days' THEN 2
      ELSE 5
    END,
    cert.expiry_date ASC NULLS LAST;
$$;

-- ─── 6. Rewrite get_compliance_expiring ────────────────────────
-- Must DROP first because return type is changing (new reminder_count column).
DROP FUNCTION IF EXISTS public.get_compliance_expiring(integer, uuid);
-- Now supports multi-reminder escalation and returns expired certs.
-- Reminder schedule:
--   0: within reminder_days_before window (first alert)
--   1-3: after expiry, at 7-day intervals (escalation)
CREATE OR REPLACE FUNCTION public.get_compliance_expiring(
  p_days_ahead integer DEFAULT 90,
  p_pm_id uuid DEFAULT NULL
)
RETURNS TABLE (
  cert_id uuid,
  property_id uuid,
  property_manager_id uuid,
  certificate_type text,
  expiry_date date,
  reminder_days_before integer,
  contractor_id uuid,
  days_remaining integer,
  property_address text,
  pm_name text,
  pm_phone text,
  pm_email text,
  contractor_name text,
  contractor_phone text,
  contractor_email text,
  contractor_contact_method text,
  reminder_count integer
)
LANGUAGE sql STABLE SECURITY DEFINER
AS $$
  SELECT
    c.id AS cert_id,
    c.property_id,
    c.property_manager_id,
    c.certificate_type::text,
    c.expiry_date,
    c.reminder_days_before,
    c.contractor_id,
    (c.expiry_date - CURRENT_DATE)::integer AS days_remaining,
    p.address AS property_address,
    pm.name AS pm_name,
    pm.phone AS pm_phone,
    pm.email AS pm_email,
    con.contractor_name,
    con.contractor_phone,
    con.contractor_email,
    con.contact_method AS contractor_contact_method,
    c.reminder_count
  FROM c1_compliance_certificates c
  JOIN c1_properties p ON p.id = c.property_id
  JOIN c1_property_managers pm ON pm.id = c.property_manager_id
  LEFT JOIN c1_contractors con ON con.id = c.contractor_id
  WHERE
    -- Must have document and expiry (otherwise 'missing', not actionable for reminders)
    c.document_url IS NOT NULL
    AND c.expiry_date IS NOT NULL
    AND (
      -- First reminder: within reminder window, not yet sent
      (c.reminder_count = 0
       AND c.expiry_date <= CURRENT_DATE + (c.reminder_days_before * interval '1 day'))
      OR
      -- Escalation reminders: expired, under 4 total, 7+ days since last
      (c.expiry_date <= CURRENT_DATE
       AND c.reminder_count < 4
       AND (c.last_reminder_at IS NULL
            OR c.last_reminder_at < CURRENT_DATE - interval '7 days'))
    )
    -- Optional PM filter
    AND (p_pm_id IS NULL OR c.property_manager_id = p_pm_id)
  ORDER BY c.expiry_date ASC;
$$;

-- ─── 7. Update compliance_upsert_certificate ───────────────────
-- Default status to 'valid' (column is dead weight now, RPCs don't read it).
-- reminder_count and last_reminder_at auto-reset via delete-then-insert.
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
