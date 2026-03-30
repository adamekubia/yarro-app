# Edge Function Flows

Step-by-step data flows for the three core edge functions. Each step shows the RPC or service called, what happens on failure, and where data moves.

---

## 1. WhatsApp Intake Flow

**Function:** `supabase/functions/yarro-tenant-intake/index.ts` (589 lines)
**Trigger:** Twilio webhook (inbound WhatsApp message)

```
Tenant sends WhatsApp message
        │
        ▼
┌─ yarro-tenant-intake ──────────────────────────────────┐
│                                                         │
│  1. Parse Twilio webhook body                           │
│     ├─ Extract: phone, message text, media URLs         │
│     └─ If no phone → return 200 (drop silently)         │
│                                                         │
│  2. Fetch Twilio media (if images attached)             │
│     └─ On failure → empty array (non-blocking)          │
│                                                         │
│  3. Call c1_context_logic RPC                           │
│     ├─ Identifies: tenant, property, conversation       │
│     ├─ Returns: AI instruction, context, stage          │
│     └─ On failure → alertTelegram, return 200           │
│        ⚠ Tenant gets no reply                           │
│                                                         │
│  4. Build AI prompt from context                        │
│     ├─ Uses: ctx.property, ctx.tenant, ctx.conversation │
│     └─ ⚠ If any ctx value is null → "null" in prompt    │
│                                                         │
│  5. Call OpenAI GPT-4o                                  │
│     ├─ Sends conversation history + system prompt       │
│     └─ On failure → alertTelegram, send fallback msg    │
│        "Sorry, I'm having a temporary issue"            │
│                                                         │
│  6. Parse AI response (JSON)                            │
│     ├─ Extract: branch, message, handoff flag           │
│     └─ Normalize handles malformed JSON gracefully      │
│                                                         │
│  7. Branch on result.branch:                            │
│     │                                                   │
│     ├─ "normal" ──────────────────────────────────────┐ │
│     │  ├─ Send reply to tenant via WhatsApp            │ │
│     │  ├─ Append to conversation (c1_convo_append)     │ │
│     │  └─ ⚠ If append fails: msg sent but not logged   │ │
│     │                                                   │
│     ├─ "final" / "handoff" / "emergency" ─────────────┐ │
│     │  ├─ Send reply to tenant via WhatsApp            │ │
│     │  ├─ Finalize conversation (c1_convo_finalize)    │ │
│     │  │   └─ ⚠ On failure: alertTelegram, return 200  │ │
│     │  │      Conversation stays open, no ticket       │ │
│     │  │                                               │ │
│     │  ├─ Call IssueAI (structured classification)     │ │
│     │  │   ├─ Categorizes, prioritizes, selects        │ │
│     │  │   │   contractor                              │ │
│     │  │   └─ On failure: uses fallback defaults       │ │
│     │  │                                               │ │
│     │  ├─ Check for existing open ticket (dedup)       │ │
│     │  │   └─ If found: skip creation, return 200      │ │
│     │  │                                               │ │
│     │  ├─ Create ticket (c1_create_ticket)             │ │
│     │  │   └─ ⚠ On failure: alertTelegram, return 200  │ │
│     │  │      CONVERSATION ALREADY CLOSED — TICKET     │ │
│     │  │      LOST, REQUIRES MANUAL RECOVERY           │ │
│     │  │                                               │ │
│     │  ├─ Upload images to Supabase Storage            │ │
│     │  │   └─ On failure: logged, continues            │ │
│     │  │      Images stay as Twilio URLs (expire)      │ │
│     │  │                                               │ │
│     │  └─ Trigger yarro-ticket-notify                  │ │
│     │      └─ On failure: alertTelegram                │ │
│     │         Ticket exists but PM never notified      │ │
│     │                                                   │
│     └─ "duplicate" / "nomatch" ───────────────────────┐ │
│        ├─ Send status reply to tenant                  │ │
│        └─ Quick finalize (c1_convo_finalize_quick)     │ │
│           └─ ⚠ No error handling on this path          │ │
│                                                         │
│  8. Top-level catch (unhandled exceptions)              │
│     └─ alertTelegram, return 200                        │
│                                                         │
└─────────────────────────────────────────────────────────┘
        │
        ▼
  Return 200 to Twilio (always)
```

---

## 2. Notification Flow

**Function:** `supabase/functions/yarro-ticket-notify/index.ts` (665 lines)
**Trigger:** Called by yarro-tenant-intake after ticket creation

```
yarro-ticket-notify receives ticket_id
        │
        ▼
┌─ Notification Logic ───────────────────────────────────┐
│                                                         │
│  1. Fetch ticket context (c1_ticket_context RPC)        │
│     └─ On failure → return 500 (caller sees error)      │
│                                                         │
│  2. Check: is it Out-of-Hours?                          │
│     ├─ If OOH enabled + outside business hours:         │
│     │   ├─ Fetch OOH contacts                           │
│     │   ├─ For EMERGENCY/URGENT: dispatch to OOH        │
│     │   └─ On failure: falls through to normal dispatch  │
│     └─ Otherwise: normal dispatch                       │
│                                                         │
│  3. Send SMS notifications (parallel via Promise.all):  │
│     ├─ PM notification (ticket summary)                 │
│     ├─ Tenant confirmation ("we've logged your issue")  │
│     ├─ Landlord notification (if configured)            │
│     └─ ⚠ If one send fails, others still complete       │
│        No rollback — inconsistent notification state    │
│                                                         │
│  4. Trigger contractor dispatch                         │
│     ├─ Call c1_contractor_context RPC                   │
│     └─ On failure: alertTelegram, return 200            │
│        ⚠ Ticket created, PM notified, but contractors   │
│        never contacted                                  │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Dispatch Flow

**Function:** `supabase/functions/yarro-dispatcher/index.ts` (487 lines)
**Trigger:** Called by yarro-ticket-notify or pg_cron (for delayed dispatches)

```
yarro-dispatcher receives instruction
        │
        ▼
┌─ Dispatch Logic ───────────────────────────────────────┐
│                                                         │
│  1. Check ticket status                                 │
│     ├─ Uses .single() — ⚠ crashes if ticket not found   │
│     └─ If status = "closed" → return 400 (skip)         │
│                                                         │
│  2. Route by instruction type:                          │
│     ├─ "contractor-sms" → send SMS to contractor        │
│     ├─ "pm-sms" → send update to PM                     │
│     ├─ "landlord-sms" → send to landlord                │
│     ├─ "tenant-sms" → send confirmation to tenant       │
│     └─ "ooh-sms" → send to out-of-hours contact         │
│                                                         │
│  3. For each SMS:                                       │
│     ├─ Call sendAndLog() (retries once on 429/5xx)      │
│     ├─ Mark as sent (c1_contractor_mark_sent etc.)      │
│     └─ ⚠ If mark fails: SMS sent but not recorded       │
│        Could cause re-send on next dispatch cycle       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## Complete End-to-End Path

```
Tenant WhatsApp msg
  → Twilio webhook
    → yarro-tenant-intake
      → c1_context_logic (identify tenant, property, conversation)
      → OpenAI GPT-4o (generate response)
      → Send reply to tenant
      → c1_convo_finalize (close conversation)
      → IssueAI (classify, prioritize, assign)
      → c1_create_ticket (create ticket record)
        → yarro-ticket-notify
          → c1_ticket_context (load full ticket data)
          → Send SMS: PM, tenant, landlord
          → c1_contractor_context (prepare dispatch)
            → yarro-dispatcher
              → Send SMS to contractor(s)
              → c1_contractor_mark_sent (record dispatch)
```

**Total RPCs in one message path:** 7+
**Total external API calls:** 1 OpenAI + 4-6 Twilio SMS
**Failure points:** 10+ (each with Telegram alert)
**Time budget:** 60 seconds (Supabase Edge Function timeout)
