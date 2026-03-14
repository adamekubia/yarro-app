import type { SupabaseClient } from "./supabase.ts";

/**
 * Log a ticket lifecycle event via c1_log_event RPC.
 * Used for events not captured by DB triggers (e.g. reminders, timeouts, escalations).
 */
export async function logEvent(
  supabase: SupabaseClient,
  ticketId: string,
  eventType: string,
  metadata: Record<string, unknown> = {},
  actorType = "SYSTEM",
  actorName: string | null = null,
): Promise<void> {
  const { error } = await supabase.rpc("c1_log_event", {
    p_ticket_id: ticketId,
    p_event_type: eventType,
    p_actor_type: actorType,
    p_actor_name: actorName,
    p_metadata: metadata,
  });

  if (error) {
    console.error(`[events] Failed to log ${eventType} for ticket ${ticketId}:`, error.message);
  }
}
