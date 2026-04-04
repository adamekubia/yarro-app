-- ============================================================================
-- Phase E: Production verification queries
--
-- Run against production AFTER deploying migrations:
--   Use Supabase SQL Editor or:
--   psql $PROD_DATABASE_URL -f supabase/tests/verify_phase_e.sql
--
-- Expected: no unexpected changes EXCEPT compliance tickets may change
-- from 'new'/'new' to 'needs_attention'/'compliance_pending'
-- ============================================================================

-- 1. Distribution of next_action_reason on open tickets
--    Look for any values NOT in the known set
SELECT next_action, next_action_reason, count(*)
FROM c1_tickets
WHERE status = 'open'
GROUP BY next_action, next_action_reason
ORDER BY count(*) DESC;

-- 2. Spot-check: 5 open maintenance tickets (non-compliance, non-rent)
--    Verify they still show expected next_action values
SELECT id, category, next_action, next_action_reason, job_stage, landlord_allocated, ooh_dispatched
FROM c1_tickets
WHERE status = 'open'
  AND (category IS NULL OR category NOT IN ('compliance_renewal', 'rent_arrears'))
  AND archived IS NOT TRUE
ORDER BY date_logged DESC
LIMIT 5;

-- 3. Spot-check: compliance tickets
--    EXPECTED: idle compliance tickets now show 'compliance_pending' instead of 'new'
SELECT id, category, next_action, next_action_reason, compliance_certificate_id
FROM c1_tickets
WHERE status = 'open'
  AND category = 'compliance_renewal'
ORDER BY date_logged DESC
LIMIT 10;

-- 4. Check for any next_action_reason values outside the known set
--    This would indicate a bug in the router
SELECT next_action_reason, count(*)
FROM c1_tickets
WHERE next_action_reason NOT IN (
  -- Universal
  'new', 'archived', 'dismissed', 'completed', 'on_hold',
  -- Maintenance
  'pending_review', 'handoff_review', 'job_not_completed', 'landlord_no_response',
  'scheduled', 'awaiting_booking', 'manager_approval', 'no_contractors',
  'landlord_declined', 'awaiting_landlord', 'awaiting_contractor',
  -- Landlord
  'allocated_to_landlord', 'landlord_needs_help', 'landlord_resolved', 'landlord_in_progress',
  -- OOH
  'ooh_dispatched', 'ooh_resolved', 'ooh_unresolved', 'ooh_in_progress',
  -- Compliance
  'cert_renewed', 'compliance_pending',
  -- Rent
  'rent_overdue', 'rent_partial_payment', 'rent_cleared'
)
  AND next_action_reason IS NOT NULL
GROUP BY next_action_reason;

-- 5. Verify router produces same results as stored values
--    Re-compute for 10 random open tickets and compare
SELECT
  t.id,
  t.category,
  t.next_action AS stored_action,
  t.next_action_reason AS stored_reason,
  r.next_action AS computed_action,
  r.next_action_reason AS computed_reason,
  CASE
    WHEN t.next_action = r.next_action AND t.next_action_reason = r.next_action_reason THEN 'MATCH'
    ELSE '** MISMATCH **'
  END AS status
FROM c1_tickets t
CROSS JOIN LATERAL c1_compute_next_action(t.id) r
WHERE t.status = 'open'
ORDER BY random()
LIMIT 10;
