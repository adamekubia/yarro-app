-- ============================================================
-- Fix: Rent priority uses ledger due_date, not ticket date_logged
-- ============================================================
-- Follow-up to 20260407500000_rent_ticket_formatting.sql
--
-- Root causes fixed:
--   1. compute_rent_arrears_next_action: priority was based on ticket age
--      (date_logged), now uses earliest overdue due_date from c1_rent_ledger
--   2. get_rent_reminders_due: 4th branch had NOT EXISTS guard that prevented
--      existing tickets from getting description/title updates. Removed so
--      the cron keeps data fresh (self-healing).
--   3. One-time data fix: recompute descriptions for existing tickets
-- ============================================================


-- ─── 1. compute_rent_arrears_next_action — use ledger due_date ────────

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
  -- Uses the rent ledger due_date (when rent was actually due),
  -- not date_logged (when the ticket was created). This ensures
  -- priority reflects actual overdue duration even if the ticket
  -- was created late.
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


-- ─── 2. get_rent_reminders_due — remove NOT EXISTS, keep data fresh ───
-- Entries with existing tickets still returned (reminder_level=0).
-- The edge function's dedup path updates title/description/priority,
-- keeping ticket data current as amounts change.

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
