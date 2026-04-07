-- ============================================================
-- Fix: Rent ticket formatting, SLA ring suppression, data fix
-- ============================================================
-- Follow-up to 20260407400000_rent_day1_tickets.sql
--
-- Changes:
--   1. create_rent_arrears_ticket: dedup path now updates issue_title
--   2. c1_get_dashboard_todo: hide SLA ring for rent/compliance
--   3. One-time data fix: normalize existing ticket titles
-- ============================================================


-- ─── 1. create_rent_arrears_ticket — dedup path updates title ─────────

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


-- ─── 2. c1_get_dashboard_todo — hide SLA ring for rent/compliance ─────

CREATE OR REPLACE FUNCTION public.c1_get_dashboard_todo(p_pm_id uuid)
 RETURNS SETOF jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN QUERY
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


-- ─── 3. One-time data fix: normalize existing rent ticket titles ──────

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
