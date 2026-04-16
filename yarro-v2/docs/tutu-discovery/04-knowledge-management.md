# 04 — Knowledge Management & Training

## Question asked
"What knowledge walks out the door with them when they leave? Where does that knowledge currently live?"

## Transcript
> To be honest, I don't know if much knowledge walks out the door with them when they leave, because clearly if they had the knowledge, they wouldn't be making these like simple, like schoolboy errors and mistakes, especially when they're not one month in, they've been with us for much longer. The knowledge currently lives in our training videos. We always try and do more training videos to add to what we currently have. And when we onboard new staff, we give that to them first to do to consume all of that information and then ask us any questions. I think we deliberately leave certain things out so that they can ask us questions to see that they're paying attention and they are ready to start the role.

## Key facts

1. **Training videos exist** — Tutu maintains a library. Actively expanding.
2. **Onboarding process:** new VAs watch training → ask questions → start role
3. **Deliberate gaps in training** — a test of whether VAs pay attention
4. **Tutu's assessment:** "Not much knowledge walks out" — because the VAs didn't have it in the first place

## What Tutu is actually saying

> "If they had the knowledge, they wouldn't be making these schoolboy errors."

The VAs who leave never absorbed the training properly. The knowledge doesn't walk out — it never walked in. This is a **signal that training videos alone don't work** for humans. They might watch. They don't retain. They don't apply.

## What Tutu missed: tacit knowledge

Tutu says "not much walks out." But actually, every VA who's been there months builds up tacit knowledge:
- "Joe the plumber is reliable, use him first"
- "Property at 42 Oak St has a weird boiler, needs extra instructions"
- "Tenant in flat 3 takes 3 days to respond to anything"
- "Council X prefers email, Council Y prefers letter"

This stuff isn't in training videos. It's built up through experience. When a VA leaves, new VA re-learns it painfully.

**Software captures this as data.** `contacts.metadata.reliability_score`, `properties.metadata.access_notes`, `contacts.metadata.response_lag_days`. Once in the system, it's permanent.

## Product implications

### Training video ingestion → AI-configured workflows
This is the "magic-first onboarding" idea from earlier:
1. Tutu uploads his training videos
2. AI transcribes and extracts:
   - Workflow patterns ("this is how we handle a turnover")
   - Message templates ("this is what we say to guests on arrival")
   - Rules ("we never send check-in until payment confirmed")
   - Preferences ("Tutu prefers contractors contacted via WhatsApp first")
3. AI generates workflow templates customised to Tutu's operation
4. Tutu reviews, adjusts, activates

The key insight: **Tutu's training videos ARE the spec.** If the AI can read them, we don't have to interview him for every detail. This saves weeks of requirements gathering.

### Structured tacit knowledge fields
Templates should have fields for notes that build up over time:
- On contacts: `reliability_notes`, `preferred_contact_method_notes`, `pricing_notes`
- On properties: `access_notes`, `quirks`, `landlord_preferences`
- On tenants: `handling_notes`, `payment_history_notes`

These are free-text fields surfaced in the UI when relevant. Every time someone interacts with that contact/property, they see the notes.

### "Deliberately leaves gaps" test → unnecessary with software
Tutu tests VAs by withholding info to see if they ask. This is a workaround for unreliable humans. Software doesn't need this test — it either has the info or it doesn't. The test goes away. Saves Tutu time.

### Videos as living documentation
"We always try and do more training videos to add to what we currently have."

Training is never "done." Tutu adds more as the business evolves. If the system ingests videos, we need a way to re-ingest when new videos are added. Either:
- Manual re-ingest ("upload this new video")
- Automated (watch a folder/Drive for new videos)

## New workflows / features revealed

| # | Feature | Type | Priority |
|---|---------|------|----------|
| 1 | Training video ingestion | Onboarding feature | Post-MVP (not blocking first user) |
| 2 | AI extraction of workflows from videos | Onboarding feature | Post-MVP |
| 3 | Tacit knowledge fields on contacts/properties | Data model | MVP — free-text notes, surface in UI |
| 4 | Notes surfaced contextually in ticket UI | UI feature | MVP — show property notes when ticket is for that property |

## Open questions
See [open-questions.md](./open-questions.md)
