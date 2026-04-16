import { createClient, SupabaseClient } from "@supabase/supabase-js";
import "dotenv/config";

// ────────────────────────────────────────────────────────────
// Setup
// ────────────────────────────────────────────────────────────

const supabase: SupabaseClient = createClient(
  process.env.SUPABASE_URL || "http://127.0.0.1:55321",
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImV4cCI6MTk4MzgxMjk5Nn0.EGIM96RAZx35lJzdJsyH-qQwv8Hdp7fsn3W0YpN81IU"
);

const PROPERTY_ID = "00000000-0000-0000-0000-000000000001";

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

async function createTicket(
  template: string,
  title: string,
  data: Record<string, unknown> = {}
): Promise<string> {
  const { data: result, error } = await supabase.rpc("create_ticket", {
    p_template_slug: template,
    p_title: title,
    p_data: data,
    p_property_id: PROPERTY_ID,
  });
  if (error) throw new Error(`create_ticket failed: ${error.message}`);
  return result as string;
}

async function updateData(
  ticketId: string,
  newFields: Record<string, unknown>
): Promise<void> {
  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select("data")
    .eq("id", ticketId)
    .single();
  if (fetchErr) throw new Error(`fetch ticket failed: ${fetchErr.message}`);
  const merged = { ...(ticket!.data as Record<string, unknown>), ...newFields };
  const { error } = await supabase
    .from("tickets")
    .update({ data: merged })
    .eq("id", ticketId);
  if (error) throw new Error(`updateData failed: ${error.message}`);
}

async function getTicket(
  ticketId: string
): Promise<{ current_state: string; bucket: string; waiting_since: string }> {
  const { data, error } = await supabase
    .from("tickets")
    .select("current_state, bucket, waiting_since")
    .eq("id", ticketId)
    .single();
  if (error) throw new Error(`getTicket failed: ${error.message}`);
  return data as { current_state: string; bucket: string; waiting_since: string };
}

async function assertState(
  ticketId: string,
  expectedState: string,
  expectedBucket: string
): Promise<void> {
  const ticket = await getTicket(ticketId);
  if (
    ticket.current_state !== expectedState ||
    ticket.bucket !== expectedBucket
  ) {
    throw new Error(
      `Expected ${expectedState}/${expectedBucket}, got ${ticket.current_state}/${ticket.bucket}`
    );
  }
}

async function getEventCount(
  ticketId: string,
  eventType: string
): Promise<number> {
  const { count, error } = await supabase
    .from("ticket_events")
    .select("*", { count: "exact", head: true })
    .eq("ticket_id", ticketId)
    .eq("event_type", eventType);
  if (error) throw new Error(`getEventCount failed: ${error.message}`);
  return count ?? 0;
}

async function getActionCount(
  ticketId: string,
  actionType?: string
): Promise<number> {
  let query = supabase
    .from("action_queue")
    .select("*", { count: "exact", head: true })
    .eq("ticket_id", ticketId);
  if (actionType) query = query.eq("action_type", actionType);
  const { count, error } = await query;
  if (error) throw new Error(`getActionCount failed: ${error.message}`);
  return count ?? 0;
}

async function backdateWaitingSince(
  ticketId: string,
  hoursAgo: number
): Promise<void> {
  const past = new Date(Date.now() - hoursAgo * 60 * 60 * 1000).toISOString();
  const { error } = await supabase
    .from("tickets")
    .update({ waiting_since: past })
    .eq("id", ticketId);
  if (error)
    throw new Error(`backdateWaitingSince failed: ${error.message}`);
}

async function triggerRecompute(ticketId: string): Promise<void> {
  // Touch data to fire the AFTER UPDATE OF data trigger
  // We add a harmless _recompute_at field — but this would fail data validation
  // if the template doesn't allow it. Instead, re-write existing data.
  const { data: ticket, error: fetchErr } = await supabase
    .from("tickets")
    .select("data")
    .eq("id", ticketId)
    .single();
  if (fetchErr) throw new Error(`triggerRecompute fetch failed: ${fetchErr.message}`);
  const { error } = await supabase
    .from("tickets")
    .update({ data: ticket!.data })
    .eq("id", ticketId);
  if (error) throw new Error(`triggerRecompute failed: ${error.message}`);
}

async function manualOverride(
  ticketId: string,
  targetState: string,
  reason?: string
): Promise<void> {
  const { error } = await supabase.rpc("manual_override", {
    p_ticket_id: ticketId,
    p_target_state: targetState,
    p_actor_name: "Test VA",
    p_reason: reason ?? null,
  });
  if (error) throw new Error(`manual_override failed: ${error.message}`);
}

async function cleanup(ticketId: string): Promise<void> {
  await supabase.from("action_queue").delete().eq("ticket_id", ticketId);
  await supabase.from("ticket_events").delete().eq("ticket_id", ticketId);
  await supabase.from("tickets").delete().eq("id", ticketId);
}

async function assertRejects(
  fn: () => Promise<unknown>,
  description: string
): Promise<void> {
  try {
    await fn();
    throw new Error(`Expected rejection: ${description}`);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.startsWith("Expected rejection")) throw e;
    // Expected error — pass
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 1: Maintenance — Happy Path
// ────────────────────────────────────────────────────────────

async function scenario1_maintenanceHappyPath() {
  const id = await createTicket("maintenance", "Leaking tap", {
    trade: "plumber",
  });
  try {
    await assertState(id, "new", "needs_action");

    await updateData(id, { contractor_name: "Joe Smith" });
    await assertState(id, "awaiting_contractor", "waiting");

    await updateData(id, { contractor_responded: true });
    await assertState(id, "awaiting_booking", "waiting");

    await updateData(id, { scheduled_date: "2026-05-01" });
    await assertState(id, "scheduled", "scheduled");

    await updateData(id, { job_completed: true });
    await assertState(id, "completed", "completed");

    // Verify audit trail
    const stateChanges = await getEventCount(id, "state_changed");
    if (stateChanges !== 4)
      throw new Error(`Expected 4 state_changed events, got ${stateChanges}`);

    const created = await getEventCount(id, "ticket_created");
    if (created !== 1)
      throw new Error(`Expected 1 ticket_created event, got ${created}`);
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 2: Maintenance — Contractor Declines → Reassign
// ────────────────────────────────────────────────────────────

async function scenario2_maintenanceDeclineReassign() {
  const id = await createTicket("maintenance", "Broken window", {
    trade: "general",
  });
  try {
    await updateData(id, { contractor_name: "Joe Smith" });
    await assertState(id, "awaiting_contractor", "waiting");

    await updateData(id, { contractor_declined: true });
    await assertState(id, "contractor_declined", "needs_action");

    // Reassign: clear declined flag, set new contractor
    await updateData(id, {
      contractor_declined: null,
      contractor_name: "Mike Repairs",
    });
    await assertState(id, "awaiting_contractor", "waiting");

    // Continue to completion
    await updateData(id, { contractor_responded: true });
    await assertState(id, "awaiting_booking", "waiting");

    await updateData(id, { scheduled_date: "2026-05-10" });
    await assertState(id, "scheduled", "scheduled");

    await updateData(id, { job_completed: true });
    await assertState(id, "completed", "completed");
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 3: Maintenance — Timeout → Late Reply
// ────────────────────────────────────────────────────────────

async function scenario3_maintenanceTimeoutLateReply() {
  const id = await createTicket("maintenance", "Faulty boiler", {
    trade: "plumber",
  });
  try {
    await updateData(id, { contractor_name: "Joe Smith" });
    await assertState(id, "awaiting_contractor", "waiting");

    // Simulate 49 hours passing
    await backdateWaitingSince(id, 49);
    await triggerRecompute(id);
    await assertState(id, "no_contractors", "needs_action");

    // Late response arrives
    await updateData(id, { contractor_responded: true });
    await assertState(id, "late_contractor_response", "needs_action");

    // PM approves the late response
    await updateData(id, { quote_approved: true });
    await assertState(id, "awaiting_booking", "waiting");

    // Continue to completion
    await updateData(id, { scheduled_date: "2026-05-15" });
    await assertState(id, "scheduled", "scheduled");

    await updateData(id, { job_completed: true });
    await assertState(id, "completed", "completed");
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 4: Cleaning — Happy Path
// ────────────────────────────────────────────────────────────

async function scenario4_cleaningHappyPath() {
  const id = await createTicket("cleaning_turnover", "Turnover #42", {
    checkout_date: "2026-05-01",
  });
  try {
    await assertState(id, "pending", "needs_action");

    await updateData(id, { cleaner_name: "Maria Garcia" });
    await assertState(id, "cleaner_notified", "waiting");

    const msgCount = await getActionCount(id, "send_message");
    if (msgCount < 1)
      throw new Error(`Expected send_message in queue, got ${msgCount}`);

    await updateData(id, { cleaner_accepted: true });
    await assertState(id, "cleaning_confirmed", "scheduled");

    await updateData(id, { cleaning_started: true });
    await assertState(id, "cleaning_in_progress", "waiting");

    await updateData(id, { cleaning_finished: true });
    await assertState(id, "inspection_ready", "needs_action");

    await updateData(id, { inspection_passed: true });
    await assertState(id, "completed", "completed");

    // 5 transitions: pending→cleaner_notified→cleaning_confirmed→cleaning_in_progress→inspection_ready→completed
    const stateChanges = await getEventCount(id, "state_changed");
    if (stateChanges !== 5)
      throw new Error(`Expected 5 state_changed events, got ${stateChanges}`);
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 5: Cleaning — Cleaner Declines → Reassign
// ────────────────────────────────────────────────────────────

async function scenario5_cleaningDeclineReassign() {
  const id = await createTicket("cleaning_turnover", "Turnover #43", {
    checkout_date: "2026-05-02",
  });
  try {
    await updateData(id, { cleaner_name: "Maria Garcia" });
    await assertState(id, "cleaner_notified", "waiting");

    await updateData(id, { cleaner_declined: true });
    await assertState(id, "cleaner_declined_state", "needs_action");

    // Reassign
    await updateData(id, { cleaner_declined: null, cleaner_name: "Sofia Lopez" });
    await assertState(id, "cleaner_notified", "waiting");

    // Continue to completion
    await updateData(id, { cleaner_accepted: true });
    await assertState(id, "cleaning_confirmed", "scheduled");

    await updateData(id, { cleaning_started: true });
    await updateData(id, { cleaning_finished: true });
    await updateData(id, { inspection_passed: true });
    await assertState(id, "completed", "completed");
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Scenario 6: Cleaning — Overdue Timeout
// ────────────────────────────────────────────────────────────

async function scenario6_cleaningOverdue() {
  const id = await createTicket("cleaning_turnover", "Turnover #44", {
    checkout_date: "2026-05-03",
  });
  try {
    await updateData(id, { cleaner_name: "Maria Garcia" });
    await updateData(id, { cleaner_accepted: true });
    await updateData(id, { cleaning_started: true });
    await assertState(id, "cleaning_in_progress", "waiting");

    // Simulate 6 hours
    await backdateWaitingSince(id, 6);
    await triggerRecompute(id);
    await assertState(id, "cleaning_overdue", "needs_action");

    // Cleaner finishes late
    await updateData(id, { cleaning_finished: true });
    await assertState(id, "inspection_ready", "needs_action");

    await updateData(id, { inspection_passed: true });
    await assertState(id, "completed", "completed");
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Cross-cutting guardrail checks
// ────────────────────────────────────────────────────────────

async function guardrail_idempotency() {
  // Double trigger fire should not create duplicate events
  const id = await createTicket("maintenance", "Idempotency test", {
    trade: "general",
  });
  try {
    await updateData(id, { contractor_name: "Joe Smith" });
    await assertState(id, "awaiting_contractor", "waiting");

    const eventsBefore = await getEventCount(id, "state_changed");

    // Trigger recompute again with same data — no transition should occur
    await triggerRecompute(id);

    const eventsAfter = await getEventCount(id, "state_changed");
    if (eventsAfter !== eventsBefore)
      throw new Error(
        `Idempotency failed: events went from ${eventsBefore} to ${eventsAfter}`
      );
  } finally {
    await cleanup(id);
  }
}

async function guardrail_unknownField() {
  // Unknown field in data should be rejected
  await assertRejects(
    () =>
      createTicket("maintenance", "Unknown field test", {
        trade: "plumber",
        bogus_field: true,
      }),
    "Unknown field should be rejected"
  );
}

async function guardrail_typeValidation() {
  // Wrong type should be rejected (contractor_responded should be boolean, not string)
  const id = await createTicket("maintenance", "Type test", {
    trade: "plumber",
  });
  try {
    await assertRejects(
      () => updateData(id, { contractor_responded: "yes" }),
      "String for boolean field should be rejected"
    );
  } finally {
    await cleanup(id);
  }
}

async function guardrail_invalidOverride() {
  // Manual override to non-allowed state should fail
  const id = await createTicket("maintenance", "Override test", {
    trade: "general",
  });
  try {
    // "new" state only allows override to "completed". Try "scheduled" which isn't in the list.
    await assertRejects(
      () => manualOverride(id, "scheduled"),
      "Override to non-allowed state should be rejected"
    );
  } finally {
    await cleanup(id);
  }
}

async function guardrail_terminalImmutability() {
  // Data change on completed ticket should not create new transitions
  const id = await createTicket("maintenance", "Terminal test", {
    trade: "general",
  });
  try {
    // Fast-track to completed via manual override
    await manualOverride(id, "completed", "Testing terminal state");
    await assertState(id, "completed", "completed");

    const eventsBefore = await getEventCount(id, "state_changed");

    // Update data — should NOT transition
    await updateData(id, { contractor_name: "Joe Smith" });
    await assertState(id, "completed", "completed");

    const eventsAfter = await getEventCount(id, "state_changed");
    if (eventsAfter !== eventsBefore)
      throw new Error("Terminal state should not transition on data change");
  } finally {
    await cleanup(id);
  }
}

async function guardrail_safeMutation() {
  // Deleting a state with an open ticket should fail
  const id = await createTicket("maintenance", "Safe mutation test", {
    trade: "general",
  });
  try {
    await assertState(id, "new", "needs_action");

    // Try to delete the 'new' state — should fail
    const { error } = await supabase
      .from("workflow_states")
      .delete()
      .eq("slug", "new")
      .eq(
        "template_id",
        "00000000-0000-0000-1000-000000000001"
      );

    if (!error)
      throw new Error("Deleting active state should have been blocked");
  } finally {
    await cleanup(id);
  }
}

async function guardrail_manualOverrideRequiresReason() {
  // Override to "completed" from "new" requires a reason
  const id = await createTicket("maintenance", "Reason test", {
    trade: "general",
  });
  try {
    await assertRejects(
      () => manualOverride(id, "completed"),
      "Override requiring reason should fail without one"
    );

    // With reason should succeed
    await manualOverride(id, "completed", "Not needed anymore");
    await assertState(id, "completed", "completed");

    // Verify manual_override event was logged
    const overrides = await getEventCount(id, "manual_override");
    if (overrides !== 1)
      throw new Error(`Expected 1 manual_override event, got ${overrides}`);
  } finally {
    await cleanup(id);
  }
}

// ────────────────────────────────────────────────────────────
// Runner
// ────────────────────────────────────────────────────────────

type Scenario = [string, () => Promise<void>];

const scenarios: Scenario[] = [
  ["Maintenance: Happy path", scenario1_maintenanceHappyPath],
  ["Maintenance: Decline → Reassign", scenario2_maintenanceDeclineReassign],
  ["Maintenance: Timeout → Late reply", scenario3_maintenanceTimeoutLateReply],
  ["Cleaning: Happy path", scenario4_cleaningHappyPath],
  ["Cleaning: Decline → Reassign", scenario5_cleaningDeclineReassign],
  ["Cleaning: Overdue timeout", scenario6_cleaningOverdue],
  ["Guardrail: Idempotency", guardrail_idempotency],
  ["Guardrail: Unknown field rejected", guardrail_unknownField],
  ["Guardrail: Type validation", guardrail_typeValidation],
  ["Guardrail: Invalid override rejected", guardrail_invalidOverride],
  ["Guardrail: Terminal immutability", guardrail_terminalImmutability],
  ["Guardrail: Safe mutation", guardrail_safeMutation],
  ["Guardrail: Override requires reason", guardrail_manualOverrideRequiresReason],
];

async function main() {
  console.log("\n=== Yarro Engine v2 — Test Suite ===\n");

  let passed = 0;
  let failed = 0;

  for (const [name, fn] of scenarios) {
    try {
      await fn();
      console.log(`  ✓ ${name}`);
      passed++;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      console.log(`  ✗ ${name}: ${msg}`);
      failed++;
    }
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

main();
