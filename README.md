# Green Book

Multi-tenant test paper generator for schools, academies, colleges, and universities.

## Stack

- Next.js 16 (App Router) + TypeScript
- Prisma + PostgreSQL (`prisma migrate deploy`)
- Better Auth (email/password + roles)
- Tailwind CSS

## Quick start

```bash
npm install
npm run db:setup
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

### Seed Super Admin

- Email: `admin@testgenerator.local`
- Password: `Admin@12345`

## Roles

| Role | Dashboard |
|------|-----------|
| Super Admin | `/super-admin` |
| Org Admin | `/org-admin` |
| Teacher | `/teacher` |

## Docs

- **Complete project documentation:** `docs/PROJECT.md`
- Schedules & teachers: `docs/schedules-and-teachers.md`
- Product requirements (SRS): `.cursor/rules/test-generator-srs.mdc`
- **Production deploy (Vercel):** `docs/DEPLOY.md`

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run dev` | Start app |
| `npm run db:push` | Sync schema |
| `npm run db:seed` | Seed Super Admin + import Biology bank |
| `npm run db:import-biology` | Import Lahore Board 9th Biology (785 Qs) |
| `npm run db:setup` | Push + seed |

## Imported content

Lahore Board → Class 9 → Biology:
- 11 chapters, 57 topics
- 785 questions (711 short, 74 long)
- Source: `data/lahore-board/9th/biology/`

