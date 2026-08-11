# Deploy on Vercel (free tier)

## Prerequisites

1. GitHub repo connected to [Vercel](https://vercel.com) (Hobby/free is fine for the app).
2. **PostgreSQL** hosted elsewhere (Neon, Supabase, Railway, etc.) — copy `DATABASE_URL`.
3. Custom domain optional; Vercel gives `*.vercel.app` with HTTPS.

## Environment variables (Vercel → Project → Settings → Environment Variables)

Set for **Production** (and Preview if you want):

| Variable | Example |
|----------|---------|
| `DATABASE_URL` | `postgresql://user:pass@host:5432/db?schema=public` |
| `BETTER_AUTH_SECRET` | 32+ char random string |
| `CRON_SECRET` | random string |
| `BETTER_AUTH_URL` | `https://your-app.vercel.app` |
| `NEXT_PUBLIC_APP_URL` | same as above |
| `APP_URL` | same as above |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `EMAIL_FROM` | your SMTP |
| `SEED_SUPER_ADMIN_*` | only for first deploy / manual seed — use strong password |

**Important:** All three URL vars must match your live HTTPS domain exactly.

## Build

Vercel runs (see `vercel.json`):

```bash
prisma migrate deploy && npm run build
```

Local check before push:

```bash
npm run build
npm start   # self-hosted only; Vercel does not use npm start
```

## First deploy

1. Push to `main` → Vercel auto-builds.
2. After first successful deploy, run seed **once** against production DB (from your machine):

   ```bash
   DATABASE_URL="postgresql://..." npm run db:seed
   ```

   Or import question banks with your existing `db:import-*` scripts.

3. Log in at `https://your-app.vercel.app/login`.

## Redeploy safely

1. Commit → push to connected branch (auto redeploy).
2. Or Vercel dashboard → **Deployments** → **Redeploy** (same commit = safe rollback reference).
3. Schema changes: commit new files under `prisma/migrations/`; deploy runs `migrate deploy` on build.
4. Never commit `.env`. Rotate secrets in Vercel if leaked.

## Cron (reminders)

`vercel.json` schedules `/api/cron/test-reminders` daily (06:00 UTC). Set `CRON_SECRET` in Vercel. Route accepts **Bearer token only**.

If cron is unavailable on your plan, call daily from an external cron:

```bash
curl -s -H "Authorization: Bearer $CRON_SECRET" https://your-app.vercel.app/api/cron/test-reminders
```

## Rollback

Vercel → Deployments → previous deployment → **Promote to Production**.

Database rollbacks are separate: restore a Postgres backup or add a new migration to fix forward.
