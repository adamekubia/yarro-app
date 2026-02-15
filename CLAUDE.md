# Yarro PM Dashboard - Workspace Instructions

## What This Is
Next.js web app for property managers using the Yarro WhatsApp maintenance system. This is the dashboard where PMs view tickets, properties, tenants, contractors, and conversations.

## Tech Stack
- Next.js 16 (App Router), React 19, TypeScript
- Tailwind CSS + shadcn/ui components
- Supabase (auth, database, realtime)
- Deployed on Vercel

## Context Files (READ before working)

These live in the parent directory (outside this app folder):

| File | What It Contains |
|------|-----------------|
| `../ANTIGRAVITY.md` | Current phase plan + outstanding tasks |
| `../architecture.md` | Full system architecture (Supabase schema, n8n flows, Twilio) |
| `../RLS_MIGRATION.md` | Row Level Security migration SQL (not yet applied) |
| `../context.md` | Client relationship context (Faraaz + Adam partnership) |

**Always read `../ANTIGRAVITY.md` first** - it has the current task list and priorities.

## Session Continuity

After completing work, update the DOE session log:
- Location: `../../../SESSION_LOG.md` (relative to this app folder)
- Follow the format in that file (Summary, Key Decisions, Files Changed, Next Session Pickup)
- This ensures the next session (in any workspace) picks up where you left off

## MCP Access

`yarro-supabase` is configured at user scope. Use it to:
- Query live data while building
- Verify RLS policies
- Check table schemas
- Test auth user state

## Database

All tables prefixed `c1_`. Key tables:
- `c1_property_managers` - PM accounts (has `user_id` for Supabase Auth)
- `c1_properties` - Properties managed
- `c1_tenants` - Tenants in properties
- `c1_contractors` - Available contractors
- `c1_tickets` - Maintenance tickets
- `c1_conversations` - WhatsApp conversation logs
- `c1_job_completions` - Contractor job completion reports

Views: `v_properties_hub` (joined property data)

## Auth Pattern

Using Supabase Auth (email/password). Session managed via cookies (not localStorage).
- Login: `supabase.auth.signInWithPassword()`
- PM lookup: query `c1_property_managers` where `user_id = auth.user.id`
- Sign out: `supabase.auth.signOut()` + clear `sb-*` cookies

**Known fix applied (uncommitted):** Race condition on re-login. See ANTIGRAVITY.md "IMMEDIATE" section.

## Dev Commands
```bash
npm run dev     # localhost:3000
npm run build   # production build check
```

## Test Credentials
- FaraazPM Demo: `faraazk2003@gmail.com`
- Amco Management: `sholom@amcomanagement.com`
(Passwords set in Supabase Auth dashboard)

## Rules
- Do NOT edit files outside `app/` (context files are read-only reference)
- Do NOT modify Supabase schema without checking with Faraaz first
- Do NOT install unnecessary dependencies
- Keep UI consistent with existing patterns (shadcn, Yarro brand colors #0059FF primary)
- All data queries must filter by `property_manager_id` from auth context

## Self-Anneal Protocol for Dev Work (MANDATORY)

Before claiming ANY fix is done, run this checklist. Faraaz reviews live — broken claims waste his time.

### 1. Verify Queries Against DB Schema
**Before writing ANY Supabase query, check the actual table columns via MCP:**
```sql
SELECT column_name FROM information_schema.columns WHERE table_name = 'c1_TABLE_NAME';
```
Never assume a column exists because the TypeScript interface says so.

**Check FK relationships before using `.select('*, related_table(col)'):`**
```sql
SELECT kcu.column_name, ccu.table_name, ccu.column_name AS fk_column
FROM information_schema.table_constraints tc
JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
WHERE tc.table_name = 'c1_TABLE_NAME' AND tc.constraint_type = 'FOREIGN KEY';
```

### 2. Check API Logs After Deploy
Use `mcp__yarro-supabase__get_logs` (service: "api") to check for 400/406 errors on the endpoints you changed. A build passing is NOT the same as queries succeeding.

### 3. Known Supabase Pitfalls
| Pitfall | Fix |
|---------|-----|
| `.single()` returns 406 on 0 or 2+ rows | Use `.maybeSingle()` + error logging |
| Column doesn't exist → 400 Bad Request | Always verify schema first |
| RLS silently returns empty (no error) | Check `pg_policies` and test with `get_pm_id()` |
| Non-existent column in `.eq()` → 400 | Same as above — verify schema |

### 4. UI Verification
- Build passing ≠ visually correct
- After pushing, think through the CSS implications of every class change
- `cn()` merges Tailwind classes — later classes override earlier ones
- When editing shared components (like InteractiveHoverButton), check ALL usage sites

### 5. Schema Reference (quick lookup)
| Table | Has `ticket_id`? | Has `created_at`? | PK relationship |
|-------|------------------|-------------------|-----------------|
| `c1_tickets` | N/A (IS tickets) | No — uses `date_logged` | — |
| `c1_conversations` | No | **No** | Own PK |
| `c1_messages` | Yes | Yes | Own PK |
| `c1_job_completions` | **No** | Yes | `id` = ticket id (FK to c1_tickets) |
