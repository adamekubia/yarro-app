-- ============================================================
-- Workflow Engine v2 — Seed Templates
-- 2 templates: Maintenance (11 states) + Cleaning Turnover (8 states)
-- Plus: sample contacts + property for testing
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- Sample data for testing
-- ────────────────────────────────────────────────────────────

INSERT INTO properties (id, name, address, property_type) VALUES
  ('00000000-0000-0000-0000-000000000001', '42 Oak Street', '42 Oak Street, London E1 6AN', 'hmo');

INSERT INTO contacts (id, name, roles, phone, preferred_channel, property_ids, metadata) VALUES
  ('00000000-0000-0000-0000-000000000010', 'Joe Smith', '{contractor}', '+447700000001', 'whatsapp',
   '{00000000-0000-0000-0000-000000000001}', '{"trades": ["plumber", "general"]}'),
  ('00000000-0000-0000-0000-000000000011', 'Maria Garcia', '{cleaner}', '+447700000002', 'whatsapp',
   '{00000000-0000-0000-0000-000000000001}', '{"availability": "weekdays"}'),
  ('00000000-0000-0000-0000-000000000012', 'Adam PM', '{owner,va}', '+447700000003', 'whatsapp',
   '{00000000-0000-0000-0000-000000000001}', '{}');

-- ════════════════════════════════════════════════════════════
-- TEMPLATE 1: MAINTENANCE (11 states)
-- Reactive workflow: issue reported → dispatch → resolve
-- ════════════════════════════════════════════════════════════

INSERT INTO workflow_templates (id, slug, name, description, category_group, data_schema, default_config)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'maintenance',
  'Maintenance & Repairs',
  'Reactive workflow for property maintenance issues. Dispatch contractor, track completion.',
  'operations',
  '{
    "fields": {
      "contractor_responded": { "type": "boolean", "required": false },
      "contractor_declined":  { "type": "boolean", "required": false },
      "contractor_name":      { "type": "text",    "required": false },
      "scheduled_date":       { "type": "text",    "required": false },
      "job_completed":        { "type": "boolean", "required": false },
      "job_not_completed_reason": { "type": "text", "required": false },
      "quote_amount":         { "type": "number",  "required": false },
      "quote_approved":       { "type": "boolean", "required": false },
      "handoff_reason":       { "type": "text",    "required": false },
      "trade":                { "type": "text",    "required": false }
    }
  }',
  '{
    "priority_weights": { "age_hours": 1, "timeout_proximity": 5, "manual_boost": 10 },
    "message_style": "professional"
  }'
);

-- State: new (initial)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, is_initial, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'new', 'New Request', 'needs_action', 0, true, 4,
  'New maintenance request — {data.trade}',
  '[{"type": "notify", "to_role": "owner", "template": "new_ticket"}]',
  '[
    {"to": "handoff_review", "when": {"field": "handoff_reason", "op": "is_not_null"}, "label": "Needs manual triage"},
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "Contractor assigned"}
  ]',
  '[{"to": "completed", "label": "Close without action", "requires_reason": true}]'
);

-- State: handoff_review
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'handoff_review', 'Needs Manual Triage', 'needs_action', 1, 4,
  'Needs manual triage — {data.handoff_reason}',
  '[{"type": "notify", "to_role": "owner", "template": "handoff_needs_review"}]',
  '[
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "PM assigned contractor"}
  ]',
  '[
    {"to": "new", "label": "Reset", "requires_reason": false},
    {"to": "completed", "label": "Close", "requires_reason": true}
  ]'
);

-- State: awaiting_contractor
INSERT INTO workflow_states (template_id, slug, name, bucket, position, timeout_hours, on_timeout, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'awaiting_contractor', 'Awaiting Contractor Response', 'waiting', 2, 48, 'no_contractors',
  'Waiting for {data.contractor_name} to respond — sent {time_since_entry} ago',
  '[{"type": "send_message", "channel": "preferred", "to_role": "contractor", "template": "contractor_dispatch"}]',
  '[
    {"to": "awaiting_booking", "when": {"field": "contractor_responded", "op": "eq", "value": true}, "label": "Contractor accepts"},
    {"to": "contractor_declined", "when": {"field": "contractor_declined", "op": "eq", "value": true}, "label": "Contractor declines"}
  ]',
  '[
    {"to": "new", "label": "Reassign", "requires_reason": false},
    {"to": "completed", "label": "Close", "requires_reason": true}
  ]'
);

-- State: contractor_declined
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'contractor_declined', 'Contractor Declined', 'needs_action', 3, 4,
  'Contractor declined — reassign needed',
  '[{"type": "notify", "to_role": "owner", "template": "contractor_declined"}]',
  '[
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "New contractor assigned"}
  ]',
  '[{"to": "completed", "label": "Close", "requires_reason": true}]'
);

-- State: no_contractors (timeout destination)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'no_contractors', 'No Response After 48h', 'needs_action', 4, 4,
  'No response after 48h — needs reassignment',
  '[{"type": "notify", "to_role": "owner", "template": "no_contractor_response"}]',
  '[
    {"to": "late_contractor_response", "when": {"field": "contractor_responded", "op": "eq", "value": true}, "label": "Late response received"},
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "New contractor assigned"}
  ]',
  '[{"to": "completed", "label": "Close", "requires_reason": true}]'
);

-- State: late_contractor_response (D019: late reply pattern)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'late_contractor_response', 'Contractor Responded Late', 'needs_action', 5, 8,
  'Contractor responded late — review needed',
  '[{"type": "notify", "to_role": "owner", "template": "late_response_review"}]',
  '[
    {"to": "awaiting_booking", "when": {"field": "quote_approved", "op": "eq", "value": true}, "label": "PM approves late response"}
  ]',
  '[
    {"to": "new", "label": "Reassign instead", "requires_reason": false},
    {"to": "completed", "label": "Close", "requires_reason": true}
  ]'
);

-- State: awaiting_booking
INSERT INTO workflow_states (template_id, slug, name, bucket, position, timeout_hours, on_timeout, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'awaiting_booking', 'Awaiting Booking Date', 'waiting', 6, 72, 'booking_stale',
  'Contractor accepted — awaiting booking date',
  '[{"type": "send_message", "channel": "preferred", "to_role": "contractor", "template": "request_booking_date"}]',
  '[
    {"to": "scheduled", "when": {"field": "scheduled_date", "op": "is_not_null"}, "label": "Date confirmed"}
  ]',
  '[
    {"to": "new", "label": "Reassign", "requires_reason": false},
    {"to": "completed", "label": "Close", "requires_reason": true}
  ]'
);

-- State: booking_stale (timeout destination)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'booking_stale', 'No Booking Date After 72h', 'needs_action', 7, 4,
  'No booking date after 72h — chase or reassign',
  '[{"type": "notify", "to_role": "owner", "template": "booking_stale"}]',
  '[
    {"to": "scheduled", "when": {"field": "scheduled_date", "op": "is_not_null"}, "label": "Date finally provided"},
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "Reassigned"}
  ]',
  '[{"to": "completed", "label": "Close", "requires_reason": true}]'
);

-- State: scheduled
INSERT INTO workflow_states (template_id, slug, name, bucket, position, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'scheduled', 'Job Scheduled', 'scheduled', 8,
  'Scheduled for {data.scheduled_date}',
  '[{"type": "notify", "to_role": "owner", "template": "job_scheduled"}]',
  '[
    {"to": "completed", "when": {"field": "job_completed", "op": "eq", "value": true}, "label": "Job completed successfully"},
    {"to": "job_not_completed", "when": {"field": "job_not_completed_reason", "op": "is_not_null"}, "label": "Job not completed"}
  ]',
  '[
    {"to": "new", "label": "Reassign", "requires_reason": false},
    {"to": "completed", "label": "Close", "requires_reason": true}
  ]'
);

-- State: job_not_completed
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'job_not_completed', 'Job Not Completed', 'needs_action', 9, 24,
  'Job not completed — {data.job_not_completed_reason}',
  '[{"type": "notify", "to_role": "owner", "template": "job_not_completed"}]',
  '[
    {"to": "awaiting_contractor", "when": {"field": "contractor_name", "op": "is_not_null"}, "label": "Re-dispatched"}
  ]',
  '[{"to": "completed", "label": "Close", "requires_reason": true}]'
);

-- State: completed (terminal)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, is_terminal, display_template, auto_actions)
VALUES (
  '00000000-0000-0000-1000-000000000001',
  'completed', 'Resolved', 'completed', 10, true,
  'Resolved',
  '[{"type": "notify", "to_role": "owner", "template": "ticket_resolved"}]'
);

-- ════════════════════════════════════════════════════════════
-- TEMPLATE 2: CLEANING TURNOVER (8 states)
-- Calendar-driven workflow: checkout → clean → ready
-- ════════════════════════════════════════════════════════════

INSERT INTO workflow_templates (id, slug, name, description, category_group, data_schema, default_config)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaning_turnover',
  'Cleaning Turnover',
  'Calendar-driven workflow for property turnovers between guests. Assign cleaner, track completion, inspect.',
  'operations',
  '{
    "fields": {
      "checkout_date":     { "type": "text",    "required": true },
      "checkin_date":      { "type": "text",    "required": false },
      "cleaner_name":      { "type": "text",    "required": false },
      "cleaner_accepted":  { "type": "boolean", "required": false },
      "cleaner_declined":  { "type": "boolean", "required": false },
      "cleaning_started":  { "type": "boolean", "required": false },
      "cleaning_finished": { "type": "boolean", "required": false },
      "inspection_passed": { "type": "boolean", "required": false },
      "inspection_notes":  { "type": "text",    "required": false },
      "photos_uploaded":   { "type": "boolean", "required": false }
    }
  }',
  '{
    "priority_weights": { "age_hours": 2, "timeout_proximity": 10, "manual_boost": 10 },
    "message_style": "professional"
  }'
);

-- State: pending (initial)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, is_initial, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'pending', 'Turnover Pending', 'needs_action', 0, true, 2,
  'Turnover pending — checkout {data.checkout_date}',
  '[{"type": "notify", "to_role": "owner", "template": "turnover_pending"}]',
  '[
    {"to": "cleaner_notified", "when": {"field": "cleaner_name", "op": "is_not_null"}, "label": "Cleaner assigned"}
  ]',
  '[{"to": "completed", "label": "Cancel turnover", "requires_reason": true}]'
);

-- State: cleaner_notified
INSERT INTO workflow_states (template_id, slug, name, bucket, position, timeout_hours, on_timeout, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaner_notified', 'Waiting for Cleaner', 'waiting', 1, 4, 'cleaner_no_response',
  'Waiting for {data.cleaner_name} to confirm — sent {time_since_entry} ago',
  '[{"type": "send_message", "channel": "preferred", "to_role": "cleaner", "template": "cleaning_request"}]',
  '[
    {"to": "cleaning_confirmed", "when": {"field": "cleaner_accepted", "op": "eq", "value": true}, "label": "Cleaner accepts"},
    {"to": "cleaner_declined_state", "when": {"field": "cleaner_declined", "op": "eq", "value": true}, "label": "Cleaner declines"}
  ]',
  '[{"to": "pending", "label": "Reassign cleaner", "requires_reason": false}]'
);

-- State: cleaner_no_response (timeout destination)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaner_no_response', 'Cleaner No Response', 'needs_action', 2, 1,
  'Cleaner hasn''t responded — reassign urgently',
  '[{"type": "notify", "to_role": "owner", "template": "cleaner_no_response"}]',
  '[
    {"to": "cleaning_confirmed", "when": {"field": "cleaner_accepted", "op": "eq", "value": true}, "label": "Late acceptance"},
    {"to": "cleaner_notified", "when": {"field": "cleaner_name", "op": "is_not_null"}, "label": "New cleaner assigned"}
  ]',
  '[{"to": "completed", "label": "Cancel", "requires_reason": true}]'
);

-- State: cleaner_declined_state
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaner_declined_state', 'Cleaner Declined', 'needs_action', 3, 1,
  'Cleaner declined — reassign urgently',
  '[{"type": "notify", "to_role": "owner", "template": "cleaner_declined"}]',
  '[
    {"to": "cleaner_notified", "when": {"field": "cleaner_name", "op": "is_not_null"}, "label": "New cleaner assigned"}
  ]',
  '[{"to": "completed", "label": "Cancel", "requires_reason": true}]'
);

-- State: cleaning_confirmed
INSERT INTO workflow_states (template_id, slug, name, bucket, position, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaning_confirmed', 'Cleaning Confirmed', 'scheduled', 4,
  '{data.cleaner_name} confirmed — scheduled for {data.checkout_date}',
  '[{"type": "notify", "to_role": "owner", "template": "cleaning_confirmed"}]',
  '[
    {"to": "cleaning_in_progress", "when": {"field": "cleaning_started", "op": "eq", "value": true}, "label": "Cleaner has started"}
  ]',
  '[
    {"to": "pending", "label": "Reassign", "requires_reason": false},
    {"to": "completed", "label": "Cancel", "requires_reason": true}
  ]'
);

-- State: cleaning_in_progress
INSERT INTO workflow_states (template_id, slug, name, bucket, position, timeout_hours, on_timeout, display_template, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaning_in_progress', 'Cleaning In Progress', 'waiting', 5, 5, 'cleaning_overdue',
  'Cleaning in progress — started {time_since_entry} ago',
  '[
    {"to": "inspection_ready", "when": {"field": "cleaning_finished", "op": "eq", "value": true}, "label": "Cleaner finished"}
  ]',
  '[{"to": "pending", "label": "Restart process", "requires_reason": false}]'
);

-- State: cleaning_overdue (timeout destination)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'cleaning_overdue', 'Cleaning Overdue', 'needs_action', 6, 1,
  'Cleaning taking over 5 hours — check in with cleaner',
  '[{"type": "notify", "to_role": "owner", "template": "cleaning_overdue"}]',
  '[
    {"to": "inspection_ready", "when": {"field": "cleaning_finished", "op": "eq", "value": true}, "label": "Cleaner finished (late)"}
  ]',
  '[
    {"to": "pending", "label": "Reassign", "requires_reason": false},
    {"to": "completed", "label": "Cancel", "requires_reason": true}
  ]'
);

-- State: inspection_ready
INSERT INTO workflow_states (template_id, slug, name, bucket, position, sla_hours, display_template, auto_actions, transitions, manual_overrides)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'inspection_ready', 'Ready for Inspection', 'needs_action', 7, 2,
  'Cleaning done — inspect and confirm ready',
  '[{"type": "notify", "to_role": "owner", "template": "ready_for_inspection"}]',
  '[
    {"to": "completed", "when": {"field": "inspection_passed", "op": "eq", "value": true}, "label": "Property ready for next guest"}
  ]',
  '[{"to": "cleaning_in_progress", "label": "Send cleaner back", "requires_reason": true}]'
);

-- State: completed (terminal)
INSERT INTO workflow_states (template_id, slug, name, bucket, position, is_terminal, display_template, auto_actions)
VALUES (
  '00000000-0000-0000-1000-000000000002',
  'completed', 'Turnover Complete', 'completed', 8, true,
  'Turnover complete — ready for next guest',
  '[{"type": "notify", "to_role": "owner", "template": "turnover_complete"}]'
);
