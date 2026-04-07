# Infrastructure

Adam owns everything:

| Service | Details |
|---------|---------|
| **Supabase** | Owner (`adam@yarro.ai`). Project ref: `qedsceehrrvohsjmbodc` |
| **Vercel (Production)** | Project: `yarro-pm` → connected to `Yarro-AI/yarro-app`. Live at **`app.yarro.ai`** (+ `yarro-pm.vercel.app`). Auto-deploys on push to upstream main. |
| **Vercel (Staging)** | Project: `yarro-app-adam` → connected to `adamekubia/yarro-app`. Live at `yarro-app-adam.vercel.app`. Auto-deploys on push to origin main. |
| **Domain** | `yarro.ai` on Namecheap. `app.yarro.ai` CNAME → `yarro-pm` Vercel project |
| **Twilio** | Adam owns. Two WhatsApp numbers: `+447446904822` (inbound), `+447463558759` (outbound) |
| **GitHub** | Dev fork: `adamekubia/yarro-app` (`origin`). Production: `Yarro-AI/yarro-app` (`upstream`) |
| **Backups** | Supabase RPCs, triggers, cron jobs exported in `.backups/supabase-export-2026-03-26/` |

## Deployment Flow

```
Code changes → git push origin main → yarro-app-adam.vercel.app (staging)
                                        ↓ verify it works
                git push upstream main → app.yarro.ai (production)
```

- **Day-to-day**: push to `origin` (personal fork). Preview on `yarro-app-adam.vercel.app`.
- **Go live**: when verified, `git push upstream main` deploys to `app.yarro.ai`.
- **Never push to upstream without verifying on staging first.**
- Both Vercel projects need identical env vars (Supabase, Sentry, etc.).
