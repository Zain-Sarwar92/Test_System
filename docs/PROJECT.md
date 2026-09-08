# Green Book — Complete Project Documentation

**Product name:** Green Book  
**Package / repo:** `test-hub` (`Test_System`)  
**Last updated:** August 2026  

Multi-tenant SaaS for schools, academies, and colleges: global question bank, scheduled test papers, teacher workflows, optional students / fees / results modules.

Related docs:

| Doc | Path |
|-----|------|
| Product MVP rules (SRS) | `.cursor/rules/test-generator-srs.mdc` |
| Schedules & teachers | `docs/schedules-and-teachers.md` |
| Production deploy (Vercel) | `docs/DEPLOY.md` |
| Root quick start | `README.md` |

---

## 1. Product overview

### 1.1 What it does

1. **Super Admin** maintains boards, classes, subjects, chapters, topics, and the **global question bank**; creates organizations and plans; approves teacher question suggestions; configures platform settings.
2. **Org Admin** manages the school: teachers, sections, branding, optional modules (students, fees, results, schedules), can generate papers for the org, and views org tests.
3. **Teacher** creates papers (auto / manual), suggests questions, edits and prints own tests, and completes schedule assignments.

### 1.2 Multi-tenancy

- Each school is an `Organization`.
- Org data (tests, teachers, students, fees, results, sections) is scoped by `organizationId`.
- Question curriculum hierarchy and bank are **global** (not per-org). Teachers **suggest** only; Super Admin owns the bank.
- Users can belong to multiple orgs via `OrgMembership`; active org is `User.organizationId`.

### 1.3 MVP vs V2

| Area | Status |
|------|--------|
| Orgs, roles, select-org | Implemented |
| Hierarchy + global bank + suggestions | Implemented |
| Generate (balanced / random / manual), post-edit, print | Implemented |
| Schedules, section coverage, day-before email | Implemented |
| Students / Fees / Results (module flags) | Implemented |
| Subscription **plan limits** UI | Implemented (no payment gateway) |
| Marks sheet OCR (Gemini) | Optional (`GEMINI_API_KEY`) |
| Student portal, online exams | **Not built** (SRS V2+) |
| Billing, analytics product, audit log, Excel product, AI questions, Word polish | **Not built** (SRS V2+) |

---

## 2. Tech stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js **16.2** (App Router), React **19** |
| Language | TypeScript |
| Database | PostgreSQL + Prisma **7** (`@prisma/adapter-pg`) |
| Auth | **better-auth** (email/password; public signup disabled) |
| UI | Tailwind CSS 4, custom UI under `src/components/ui`, lucide-react, next-themes |
| Validation | Zod 4 |
| Email | nodemailer (SMTP) |
| Deploy | Vercel (`vercel.json`); local DB via Docker Compose |
| Dev port | **5001** (`npm run dev`) |

Most business logic uses **Server Actions** (`actions.ts`), not REST. Only a few API routes exist (auth, cron, result sheet images).

> This Next.js version may differ from older training data; check `node_modules/next/dist/docs/` when changing framework APIs (`AGENTS.md`).

---

## 3. Roles & access

### 3.1 Roles

| Role | Dashboard | Typical powers |
|------|-----------|----------------|
| `SUPER_ADMIN` | `/super-admin` | Orgs, plans, hierarchy, bank, suggestions, all tests, system settings |
| `ORG_ADMIN` | `/org-admin` | Teachers, sections, schedules, org tests/generate, branding, modules |
| `TEACHER` | `/teacher` | Own tests, generate (scoped), suggestions, assigned schedules |

### 3.2 Auth behaviour

- Files: `src/lib/auth.ts`, `src/lib/auth-client.ts`, `src/app/api/auth/[...all]/route.ts`
- Session ~7 days; role / org injected into session from DB
- No `middleware.ts` — layouts and actions call `requireRole` / `requireSession` (`src/lib/rbac.ts`)
- Login rate limiting: `src/lib/login-rate-limit.ts`
- Inactive user / inactive org → login errors (`/login?error=…`)

### 3.3 Multi-org

- `/select-org` — pick active membership (Super Admin skips this)
- Switching org updates `User.organizationId` **and** `User.role` from that membership

### 3.4 Teacher level

One account = one `TeacherLevel`:

| Level | Classes |
|-------|---------|
| `PRIMARY` | Nursery, Prep, Class 1–8 |
| `MATRIC` | Class 9–10 |
| `INTERMEDIATE` | Class 11–12 |

Subject / schedule assignment must match the teacher’s level. See `docs/schedules-and-teachers.md`.

### 3.5 Curriculum access (org setting)

| Mode | Meaning |
|------|---------|
| `ASSIGNED_ONLY` (default) | Teacher generate limited to assigned class/subject |
| `ALL_CURRICULUM` | Teacher can use full curriculum for generate |

Configured under Org Admin → Profile.

### 3.6 Org modules

Flags on `Organization` gate nav and pages:

| Key | Flag | Feature |
|-----|------|---------|
| Students | `moduleStudents` | Rolls, custom fields, section lists |
| Results | `moduleResults` | Marks, gazettes, series |
| Fees | `moduleFees` | Heads, plans, dues, collection |
| Schedules | `moduleSchedules` | Named exam schedules + teacher assignments |

Catalog: `src/lib/org-module-catalog.ts`.

---

## 4. Application routes

### 4.1 Public

| Route | Purpose |
|-------|---------|
| `/` | Landing; redirects logged-in users to role home |
| `/login` | Email / password |
| `/select-org` | Choose active organization |

### 4.2 Super Admin (`/super-admin`)

| Route | Purpose |
|-------|---------|
| `/super-admin` | Dashboard |
| `/super-admin/organizations`, `/list`, `/[id]` | Create / list / edit tenants |
| `/super-admin/hierarchy` | Board → Class → Subject → Chapter → Topic |
| `/super-admin/questions`, `/list`, `/[id]/edit` | Global bank |
| `/super-admin/suggestions` | Approve / reject teacher suggestions |
| `/super-admin/tests`, `/[id]/print` | Cross-tenant tests |
| `/super-admin/plans` | Plan limits (teachers / tests metadata) |
| `/super-admin/settings` | Platform name, defaults, maintenance |

### 4.3 Org Admin (`/org-admin`)

| Route | Purpose |
|-------|---------|
| `/org-admin` | Dashboard |
| `/org-admin/sections` … | Section master (e.g. Class 9 → Red) |
| `/org-admin/teachers` … | Teachers + class/section/subject assignments |
| `/org-admin/schedules` … | Test schedules (if module on) |
| `/org-admin/generate` | Same generate wizard as teachers |
| `/org-admin/tests` … | Org papers |
| `/org-admin/students` … | Students module |
| `/org-admin/fees` … | Fees module |
| `/org-admin/results` … | Results module |
| `/org-admin/profile` | Branding + curriculum access |

### 4.4 Teacher (`/teacher`)

| Route | Purpose |
|-------|---------|
| `/teacher` | Workspace |
| `/teacher/schedules` | Assigned tests |
| `/teacher/generate` | Paper wizard |
| `/teacher/tests`, `/[id]`, `/[id]/print` | Own papers, edit, print |
| `/teacher/suggestions` | Suggest questions |

### 4.5 HTTP API (few routes)

| Path | Purpose |
|------|---------|
| `/api/auth/[...all]` | better-auth |
| `/api/cron/test-reminders` | Day-before reminder job (`Authorization: Bearer CRON_SECRET`) |
| `/api/org-admin/result-sheets/[sheetId]` | Serve uploaded marks sheet images |

---

## 5. Data model (Prisma)

Schema: `prisma/schema.prisma`

### 5.1 Auth & tenancy

- `User`, `Session`, `Account`, `Verification`
- `Organization` — branding, plan, module flags, `curriculumAccessMode`
- `OrgMembership` — multi-org link
- `SubscriptionPlan` — max teachers / tests (no billing)
- `SystemSetting` — key/value platform config

### 5.2 Curriculum hierarchy

```
Board → Class → Subject → Chapter → Topic → Question
```

- `Subject` may have track (`COMMON` / `SCIENCE` / `ARTS`) and elective group
- `Section` — org-scoped class sections (e.g. Red, A)
- `TeacherAssignment` — teacher × class × section × subject
- Deprecated: `TeacherSubject` (legacy cutover)

### 5.3 Questions

- Types: `MCQ` (4 options + correct), `SHORT`, `LONG`
- Fields: `text`, `textUrdu`, `subType`, `marks`, `source`, `externalKey`, `isActive`
- `QuestionSuggestion` — `PENDING` / `APPROVED` / `REJECTED`

### 5.4 Tests

- `Test` — org, teacher, subject, exam meta, `distributionMode`, optional schedule link
- `TestQuestion` — order, marks, optional per-paper text/option overrides

### 5.5 Schedules

```
TestSchedule
  └── TestScheduleRound
        └── TestScheduleSubject (subjectName + testDate)
              └── TestScheduleSubjectClass (class + subject FK)
                    └── TestScheduleAssignment (teacher + section)
                          ├── test? (primary paper)
                          └── coveredByTest? (shared multi-section paper)
```

Assignment fields of note:

- `syllabusText` — teacher-entered syllabus for org admin
- `reminderSentAt` — reminder already emailed
- `completedAt` — completion timestamp (status still requires linked paper)
- `coveredByTestId` — another (same teacher) section covered by one paper

### 5.6 Students / fees / results

- Students: `Student`, electives, custom field definitions/values
- Fees: `FeeHead`, `FeePlan`, items, `FeeCharge`, `FeePayment`, allocations
- Results: `ResultSeries`, `ExamTerm`, `SubjectAssessment`, `StudentMark`, `AssessmentSheet`, `AssessmentManualMark`

---

## 6. Question bank & content pipeline

### 6.1 Ownership

- Super Admin CRUD on global bank
- Teachers submit suggestions → Super Admin approve creates a real `Question`

### 6.2 English / Urdu / Islamiyat field types

Generate UI supports **subType / field** filters (spelling, meaning, verb, DI, essays, summary, translate, poem, passage, ayat, hadith, etc.):

- `src/app/teacher/generate/english-fields.ts`
- `src/lib/english-field-utils.ts`
- Medium filter: English / Urdu / Both
- Source filter: All / Exercise / Additional

### 6.3 Import scripts (Lahore / PTB)

Data lives under `data/lahore-board/…`. Typical pipeline:

1. **Export** from PTS (`db:export-*`)
2. **Build** seed JSON (`db:build-*`)
3. **Import** into DB (`db:import-*`)

Examples: Biology, Chemistry, Physics, Computer, English, Mathematics, Pak Studies, Class 9 all subjects, Intermediate 1 & 2.  
Bulk: `npm run db:seed-ptb-all`, audit: `npm run db:audit-ptb`.

---

## 7. Test generation

**UI:** `src/app/teacher/generate/generate-wizard.tsx`  
**Shared** by `/teacher/generate` and `/org-admin/generate`.  
**Engine:** `src/lib/distribution/engine.ts`

### 7.1 Flow

1. Board → Class → Subject (or locked from schedule assignment)
2. Chapters / topics (editable)
3. Counts by type (and English field quotas where applicable)
4. Workspace → review → save paper

### 7.2 Modes

| Mode | Behaviour |
|------|-----------|
| **Balanced (default auto)** | Round-robin ~1 question per topic per round |
| **Random** | Random pick from pool |
| **Manual** | Teacher picks from search pool |

Chapter quotas supported via chapter plan helpers.

### 7.3 Schedule-linked generate

- Open from assignment: subject + exam date **locked** to schedule
- On save: links `Test` ↔ `TestScheduleAssignment`, sets `completedAt`
- Multi-section text in `classSection` (e.g. `Red, A`) covers **same teacher’s** sibling assignments only (`coverSiblingAssignmentsForSections` in `src/lib/test-schedules.ts`)

### 7.4 Post-edit (saved paper)

On `/teacher/tests/[id]`:

- Remove / reorder / replace / add questions
- Per-question text overrides
- Update meta (title, duration, instructions, sections, etc.)
- Replace whole section contents

### 7.5 Export / print

- Print routes use browser **Print / Save PDF** (`window.print`)
- Header uses org logo, name, address; marks, time, instructions on sheet
- Components: `ExamPaperSheet`, etc.

### 7.6 Visibility

| Who | Sees |
|-----|------|
| Teacher | Own tests |
| Org Admin | Org tests |
| Super Admin | All tests |

Deleting a **teacher** or **schedule** keeps existing papers (links cleared as needed).

---

## 8. Schedules & reminders (detail)

Full feature write-up: `docs/schedules-and-teachers.md`.

### 8.1 Org Admin create wizard

Name → Board → Classes → Subjects → per-subject dates + teachers per class/section.

Schedule **name** = exam / test type label (e.g. Mid Term).

### 8.2 Assignment status

`src/lib/test-schedule-status.ts` — `PENDING_WINDOW_DAYS = 7`

| Status | Rule |
|--------|------|
| `COMPLETED` | Paper linked (`test` or `coveredByTest`) |
| `OVERDUE` | No paper + date in the past |
| `PENDING` | No paper + due within **7 days** |
| `UPCOMING` | No paper + further out |

In-app “prepare soon” ≠ email. Email is **only the day before**.

### 8.3 Reminders

- Lib: `src/lib/test-schedule-reminders.ts`
- Eligible: due **tomorrow**, no test, not covered, reminder not sent, teacher active, schedule `ACTIVE`
- One **digest email per teacher** (all their pending items)
- Cron: `vercel.json` → `/api/cron/test-reminders` daily 06:00 UTC
- Local: `npm run reminders:run`

**Important behaviour (multi-teacher same subject):**

- If 3 Physics teachers are assigned and only **one** creates a paper, the **other two still get reminder email** (their assignments remain incomplete).
- Writing other teachers’ sections in `classSection` does **not** complete those teachers’ assignments — coverage is **same teacher only**.

### 8.4 Cancel vs delete

- **Cancel** → status `CANCELLED`; teachers cannot create for it
- **Delete** → schedule removed; papers kept

---

## 9. Students, fees, results

### 9.1 Students

- CRUD, roll number, father, phone, stream (Science/Arts), study group (11/12), electives
- Custom field definitions + values
- Print section lists

### 9.2 Fees

- Heads + plans (monthly / quarterly / annual / one-time)
- Generate charges by period
- Collect payments + allocations
- Dues ledger (`UNPAID` / `PARTIAL` / `PAID` / `WAIVED`)

### 9.3 Results

- Class → section → exam terms and/or result series
- Subject assessments + roster marks; manual non-roster rows
- Optional photo sheet upload + Gemini OCR (`src/lib/marks-ocr.ts`)
- Gazette / award list print views

---

## 10. Environment variables

Copy `.env.example` → `.env`. Never commit secrets.

| Variable | Purpose |
|----------|---------|
| `DATABASE_URL` | PostgreSQL |
| `APP_URL`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | Must match live base URL |
| `BETTER_AUTH_SECRET` | 32+ chars |
| `BETTER_AUTH_TRUSTED_ORIGINS` | Optional extra origins |
| `CRON_SECRET` | Bearer for reminder cron |
| `SMTP_*`, `EMAIL_FROM` | Reminder mail |
| `SEED_SUPER_ADMIN_*` | First seed only |
| `GEMINI_API_KEY` / `GEMINI_MODEL` | Optional OCR (not in `.env.example`) |

---

## 11. Local setup

```bash
npm install
npm run db:local:up          # Docker Postgres
npm run db:local:setup       # or: npm run db:setup
npm run dev                  # http://localhost:5001
```

Seed Super Admin (dev defaults in README — **change in production**):

- Email: `admin@testgenerator.local`
- Password: `Admin@12345`

Useful scripts:

| Script | Purpose |
|--------|---------|
| `npm run db:seed` | Super Admin (+ bank import as configured) |
| `npm run db:seed-demo-system` | Demo org/teachers |
| `npm run db:seed-primary` | Primary curriculum |
| `npm run smoke:all` | End-to-end smoke |
| `npm run smoke:schedules-teachers` | Schedule/teacher smoke |
| `npm run reminders:run` | Send reminders now |

---

## 12. Production deploy

See `docs/DEPLOY.md`.

Summary:

1. Host Postgres (e.g. Neon)
2. Set env vars on Vercel (URLs must be HTTPS and consistent)
3. Build runs `prisma migrate deploy` then Next build
4. Seed once against production DB from your machine
5. Cron hits `/api/cron/test-reminders` with `CRON_SECRET`

---

## 13. Key source map

| Area | Path |
|------|------|
| Schema | `prisma/schema.prisma` |
| Auth / RBAC | `src/lib/auth.ts`, `src/lib/rbac.ts` |
| Modules | `src/lib/org-modules.ts`, `src/lib/org-module-catalog.ts` |
| Distribution | `src/lib/distribution/engine.ts` |
| Generate UI | `src/app/teacher/generate/` |
| Schedules access / coverage | `src/lib/test-schedules.ts` |
| Schedule status | `src/lib/test-schedule-status.ts` |
| Reminders | `src/lib/test-schedule-reminders.ts`, `src/lib/email.ts` |
| Org schedules UI | `src/app/org-admin/schedules/` |
| Teacher schedules | `src/app/teacher/schedules/` |
| Question bank UI | `src/app/super-admin/questions/`, `suggestions/` |
| Content data | `data/lahore-board/` |
| Import/seed scripts | `scripts/` |

---

## 14. Known limitations

1. One teacher level per account (multi-level needs a redesign).
2. Existing schedules: create / cancel / delete — full restructure after create is limited.
3. Section coverage across **different** teachers is not supported (each teacher must complete their own assignment or get reminders).
4. Print = browser PDF, not a dedicated server PDF engine.
5. Plans are metadata only — no Stripe/billing.
6. Student portal / online exams are out of scope for current codebase.

---

## 15. Typical user journeys

### Super Admin — stand up a school

1. Create organization (+ first org admin)  
2. Assign plan / enable modules  
3. Ensure hierarchy + questions exist (seed/import)  
4. Approve suggestions over time  

### Org Admin — exam week

1. Ensure sections + teachers assigned  
2. Create schedule (dates + teachers per section)  
3. Track completion on schedule detail / print  
4. Optional: generate org paper, manage students/fees/results  

### Teacher — paper from schedule

1. Open **My Assigned Tests**  
2. Create Test → locked subject/date → generate/edit → save  
3. Print / Save PDF  
4. Optional: suggest missing questions; mention multiple **own** sections in paper if one paper covers several  

---

*End of project documentation.*
