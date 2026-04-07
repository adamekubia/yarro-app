-- ============================================================
-- Fix: Prevent duplicate rent ledger entries per room/month
-- ============================================================
-- Problem: ON CONFLICT (room_id, due_date) DO NOTHING doesn't
-- prevent two entries for the same room in the same month if
-- rent_due_day changes. This adds a same-month guard and cleans
-- up existing duplicates.
-- ============================================================


-- ─── 1. Clean up existing duplicates ──────────────────────────────────
-- Keep the entry with the latest due_date per room/month (reflects
-- current rent_due_day config). Delete older ones, but only if they
-- are 'pending' or 'overdue' (never delete paid/partial entries).

DELETE FROM c1_rent_ledger
WHERE id IN (
  SELECT rl.id
  FROM c1_rent_ledger rl
  JOIN (
    -- Find rooms with multiple entries in the same month
    SELECT room_id,
           date_trunc('month', due_date)::date AS month_start,
           MAX(due_date) AS keep_due_date
    FROM c1_rent_ledger
    GROUP BY room_id, date_trunc('month', due_date)::date
    HAVING COUNT(*) > 1
  ) dups ON dups.room_id = rl.room_id
       AND date_trunc('month', rl.due_date)::date = dups.month_start
       AND rl.due_date != dups.keep_due_date
  WHERE rl.status IN ('pending', 'overdue')
);


-- ─── 2. create_rent_ledger_entries — add same-month guard ─────────────

CREATE OR REPLACE FUNCTION public.create_rent_ledger_entries(
  p_property_id uuid,
  p_pm_id uuid,
  p_month integer,
  p_year integer
)
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_count integer;
BEGIN
  -- Validate month/year
  IF p_month < 1 OR p_month > 12 THEN
    RAISE EXCEPTION 'Month must be between 1 and 12';
  END IF;
  IF p_year < 2020 OR p_year > 2100 THEN
    RAISE EXCEPTION 'Year out of range';
  END IF;

  -- Insert one row per occupied room with rent configured.
  -- ON CONFLICT DO NOTHING makes this idempotent for same due_date.
  -- NOT EXISTS guard prevents a second entry in the same month if
  -- rent_due_day was changed after initial generation.
  INSERT INTO c1_rent_ledger (
    property_manager_id,
    room_id,
    tenant_id,
    due_date,
    amount_due
  )
  SELECT
    p_pm_id,
    r.id,
    r.current_tenant_id,
    make_date(p_year, p_month, COALESCE(r.rent_due_day, 1)),
    r.monthly_rent
  FROM c1_rooms r
  WHERE r.property_id = p_property_id
    AND r.property_manager_id = p_pm_id
    AND r.current_tenant_id IS NOT NULL
    AND r.monthly_rent IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM c1_rent_ledger rl2
      WHERE rl2.room_id = r.id
        AND rl2.due_date >= make_date(p_year, p_month, 1)
        AND rl2.due_date < (make_date(p_year, p_month, 1) + interval '1 month')::date
    )
  ON CONFLICT (room_id, due_date) DO NOTHING;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
