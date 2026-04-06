-- ============================================================
-- Performance indexes for dashboard RPCs
-- Safe: additive only, no function changes
-- ============================================================

-- 1. c1_messages: stage + ticket_id for contractor_timing CTE
--    The CTE filters WHERE stage = 'waiting_contractor' and GROUP BY ticket_id.
--    Currently the only index on c1_messages is a partial on archived.
CREATE INDEX IF NOT EXISTS idx_c1_messages_stage_ticket
  ON public.c1_messages (stage, ticket_id);

-- 2. c1_tickets: partial index matching the exact dashboard WHERE clause
--    Used by c1_get_dashboard_todo's pm_tickets and scored CTEs.
CREATE INDEX IF NOT EXISTS idx_c1_tickets_dashboard
  ON public.c1_tickets (property_manager_id)
  WHERE lower(status) != 'closed'
    AND COALESCE(archived, false) = false
    AND COALESCE(on_hold, false) = false;

-- 3. c1_tickets: composite for rent dedup NOT EXISTS in c1_get_dashboard_todo_extras
--    rent_items CTE checks (tenant_id, category='rent_arrears', status='open').
CREATE INDEX IF NOT EXISTS idx_c1_tickets_rent_dedup
  ON public.c1_tickets (tenant_id, category, status);

-- 4. c1_tickets: conversation_id for handoff NOT EXISTS in c1_get_dashboard_todo_extras
--    handoff_items CTE checks NOT EXISTS (... WHERE conversation_id = c.id).
CREATE INDEX IF NOT EXISTS idx_c1_tickets_conversation
  ON public.c1_tickets (conversation_id)
  WHERE conversation_id IS NOT NULL;
