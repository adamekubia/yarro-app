# Open Questions for Tutu

Questions we'd ideally have answers to before finalising templates. Add as they come up.

## From voice note 01 (Roles)

- For guest communication **proactive** — what are the specific touchpoints? (On arrival day? Mid-stay when?) Exact timings matter for the state machine.
- For **reactive** guest messages — does he expect AI to auto-answer common questions (wifi, directions), or surface all to him? Changes whether we build an AI response layer or just a smart queue.
- When a landlord-responsibility issue comes up — does the landlord get contacted directly, or does Tutu mediate? Different flows.
- **Check-in coordination** — is this distinct from guest comms, or part of it? (e.g., "send door code" might be a check-in task, not a comms touchpoint.)
- **Monthly payout breakdowns** — to whom? Landlords? Owners? Template per recipient?
- **Contract "other information"** — what are the fields? Examples would help shape the form workflow.
- When a contract is sent, how does Tutu know it's been signed? DocuSign-style integration, or manual confirmation?

(Add answers here as they come in, don't delete — keep the audit trail.)

## From voice note 02 (Failure moments)

- Which group chats does Tutu have the VAs monitor? (Per-property? One master? Per-tenant?) This shapes the webhook/ingestion architecture.
- For payment confirmation — is this manual (VA checks bank, updates ticket) or integrated (Stripe/bank webhook)? Changes whether it's a human gate or automated.
- For "extra details" on contracts — what's the typical "standard" vs "extra"? Helps us figure out what to prompt for.
- For payout breakdowns — what's the format? PDF? Spreadsheet? Message in WhatsApp? And who approves before sending?
- When a tenant signs a contract, what specifically should "chase them up" do? Payment request? Onboarding checklist? Both?

## From voice note 03 (Termination triggers)

- For the guest proactive check-in — what exact timings does Tutu want? (T+4h? T+6h? Morning = 9am local?) And what channels (Airbnb message, WhatsApp, both)?
- For Section 21 and other legal notices — what other notices does he regularly serve? (Section 8? Notice to quit?) Each has different rules.
- For tenant type routing — what are ALL the types? (Private, council, housing benefit, DSS, student, corporate lets?) Each likely needs different onboarding.
- For post-stay review monitoring — which platforms? Airbnb API integration? Manual "did we get a review?" check?
- For email ingestion — which inboxes? Is there a shared "ops@" address, or his personal email, or both?

## From voice note 04 (Knowledge management)

- Where do the training videos live? (YouTube, Loom, Google Drive, Dropbox?) Needed to know if we can ingest programmatically.
- How many videos is "the library"? Order of magnitude? (5, 50, 500?) Changes the ingestion approach.
- Does Tutu want to share the videos with Yarro for AI ingestion, or does he want to manually configure the system with our help? (Trust/control question.)
- For tacit knowledge — does Tutu already keep notes somewhere about specific contractors/tenants/properties? (Spreadsheet? Notion?) If so, we should ingest that too.

## Voice note 01 (Roles) open questions — still unanswered
- For **reactive** guest messages — does he expect AI to auto-answer common questions (wifi, directions), or surface all to him?
- When a landlord-responsibility issue comes up — does the landlord get contacted directly, or does Tutu mediate?
- **Check-in coordination** — distinct from guest comms, or part of it?
- **Monthly payout breakdowns** — to whom? Landlords? Owners? Template per recipient?
- **Contract "other information"** — what are the fields?
- Contract signing — how does Tutu know it's signed? DocuSign, manual confirmation?
