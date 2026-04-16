-- ============================================================
-- RLS policies for yarro-v2 MVP
-- Single-user policy: auth.uid() IS NOT NULL
-- Multi-tenant policies = post-MVP
-- ============================================================

-- Enable RLS on all tables
ALTER TABLE workflow_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE workflow_states ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE tickets ENABLE ROW LEVEL SECURITY;
ALTER TABLE ticket_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE action_queue ENABLE ROW LEVEL SECURITY;

-- Simple policies: any authenticated user has full access
-- These will be replaced with multi-tenant policies when we have multiple PMs

CREATE POLICY "authed_users_all" ON workflow_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON workflow_states
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON properties
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON contacts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON tickets
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON ticket_events
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "authed_users_all" ON action_queue
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
