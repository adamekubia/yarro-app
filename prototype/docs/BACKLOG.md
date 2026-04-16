# Backlog — Workflow Engine v2

Items captured during sessions. Not prioritised, not assigned. Deal with later.
Grouped by layer so items are triaged against the right build phase.

## Engine

- Date type detection for comparison operators (currently numeric only)
- Guest stay template (3rd workflow type)
- OOH dispatch states (maintenance)
- Landlord allocation states (maintenance)
- Reschedule flow states (maintenance)

## Contacts & Properties

- `contact_properties` join table (currently uuid array — D013)

## Comms Layer

- WhatsApp/SMS/email delivery from action_queue
- Notification throttling logic (queue exists, draining logic doesn't)
- AI message composition

## UI Layer

- Dashboard (bucket grouping, priority sorting)
- Ticket detail view
- Manual override UI
- Action confirmation UI (pending_confirmation queue)

## Configuration

- PM-level workflow configuration overrides
- Onboarding/training doc ingestion
