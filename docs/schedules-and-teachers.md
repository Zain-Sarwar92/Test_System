# Schedules & Teachers — Feature Documentation

Last updated: 30 July 2026

This document covers the work delivered around **test scheduling**, **teacher levels**, and related fixes.

---

## 1. Overview

Org Admins can plan exams as hierarchical schedules, assign teachers by class, and track paper completion. Teachers create papers from their assignments. Teachers are typed as **Primary / Matric / Intermediate** so class-level assignment stays consistent.

### Roles involved

| Role | Capabilities |
|------|----------------|
| Org Admin | Create/view/delete schedules; add/deactivate/delete teachers |
| Teacher | See assigned schedules; create paper from assignment; delete own papers |

---

## 2. Teacher types (levels)

| Type | Classes |
|------|---------|
| **Primary** | Nursery, Prep, Class 1–8 |
| **Matric** | Class 9–10 |
| **Intermediate** | Class 11–12 |

### Rules

- One user account = **one email** = **one teacher type**
- Same email cannot be registered under multiple types
- Subject assignment only maps to subjects on classes for that type
- Schedule create only shows eligible teachers for the selected classes’ level

### Schema

- `User.teacherLevel` → enum `PRIMARY | MATRIC | INTERMEDIATE` (nullable for legacy)

### UI flow — Add Teacher (`/org-admin/teachers/new`)

1. **Details** — name, email, password, teacher type  
2. **Subjects** — subjects filtered to that type’s classes  
3. Create  

### UI — Teachers list (`/org-admin/teachers`)

- Shows type chip + subject chips  
- **Deactivate** / **Activate**  
- **Delete** only when inactive → permanent DB delete (cascades related teacher data)

---

## 3. Test schedules

### Data model

```
TestSchedule
  └── TestScheduleSubject (subjectName + testDate)
        └── TestScheduleSubjectClass (class + subject mapping)
              └── TestScheduleAssignment (teacher)
                    └── Test? (optional linked paper)
```

### Create flow (`/org-admin/schedules/new`)

Wizard steps:

1. **Name**  
2. **Board**  
3. **Classes** (from that board)  
4. **Subjects** (from curriculum for selected classes — not only teacher-mapped subjects)  
5. **Details** — per subject: test date + teachers per class  

Teachers shown on step 5:

- Must be mapped to that class’s subject  
- Must have matching `teacherLevel` for that class  

### List (`/org-admin/schedules`)

- Progress bar, subject chips, status  
- **Open** + **Delete** on each card  

### Detail (`/org-admin/schedules/[id]`)

Table format:

| Date | Subject | Class 9 | Class 10 | … |
|------|---------|---------|----------|---|
| schedule date | subject | teacher names + status | … | |

Also: overall progress, cancel, delete.

### Delete behaviour

- **Delete schedule** always removes the schedule from DB  
- Linked papers are **kept**; `Test.scheduleAssignmentId` is cleared  
- Redirects to schedules list  

### Cancel behaviour

- Sets schedule `status = CANCELLED`  
- Teachers can no longer create papers for it  

---

## 4. Teacher schedule → paper creation

### Teacher list (`/teacher/schedules`)

- Assignments sorted by urgency (OVERDUE → PENDING → UPCOMING → COMPLETED)  
- Summary counts + **Create Test** / **View Test**  

### Generate from assignment (`/teacher/generate?assignmentId=…`)

- Board / class / subject locked to assignment  
- **Exam date locked** to schedule test date (cannot change)  
- On save, server forces schedule date again  
- Sets `Test.scheduleAssignmentId` + assignment `completedAt`  

### Paper delete (`deleteTeacherTest`)

- Clears assignment `completedAt`  
- Removes paper  
- Schedule status reopens (OVERDUE / PENDING / UPCOMING)  

---

## 5. Assignment status logic

Implemented in `src/lib/test-schedule-status.ts`.

| Status | Meaning |
|--------|---------|
| **COMPLETED** | A paper is **currently linked** (`hasCreatedTest`) |
| **OVERDUE** | No paper + test date in the past |
| **PENDING** | No paper + test within next 3 days |
| **UPCOMING** | No paper + test further ahead |

Important:

- Orphan `completedAt` alone does **not** mark COMPLETED  
- Deleting a paper correctly reopens the assignment  

If paper exam date ≠ schedule date (legacy), detail view shows a mismatch note.

---

## 6. Curriculum support

Primary classes were seeded for both boards:

- Classes: Nursery, Prep, Class 1–8  
- Subjects: English, Urdu, Mathematics, Science, Islamiyat, Social Studies  

Script:

```bash
npm run db:seed-primary
```

Matric / Intermediate classes (9–12) remain on Federal + Lahore boards.

---

## 7. Key files

| Area | Path |
|------|------|
| Teacher levels helper | `src/lib/teacher-level.ts` |
| Status helper | `src/lib/test-schedule-status.ts` |
| Schedule access | `src/lib/test-schedules.ts` |
| Org schedules UI | `src/app/org-admin/schedules/**` |
| Org teachers UI | `src/app/org-admin/teachers/**` |
| Teacher schedules | `src/app/teacher/schedules/**` |
| Generate + date lock | `src/app/teacher/generate/**` |
| Paper delete | `src/app/teacher/tests/actions.ts` |
| Reminders (cron) | `src/app/api/cron/test-reminders/route.ts` |
| Smoke test | `scripts/smoke-schedules-teachers.ts` |

---

## 8. Smoke test

```bash
npm run smoke:schedules-teachers
```

Checks:

- Boards + Primary/Matric/Intermediate curriculum  
- Teacher level helpers  
- Status rules (including orphan `completedAt`)  
- Unique teacher emails  
- Teacher subject mappings vs type  
- Schedule teacher-level integrity  
- Paper date vs schedule date mismatches (reports legacy)  
- Auto-clears orphan `completedAt` if found  

Latest run (30 Jul 2026): **14/14 passed** after healing one orphan `completedAt`.

---

## 9. Manual QA checklist

### Teachers

- [ ] Add Primary / Matric / Intermediate teacher  
- [ ] Same email rejected on second create  
- [ ] Subjects list matches type  
- [ ] Deactivate → Delete appears → Delete removes from list permanently  

### Schedules

- [ ] Create: Name → Board → Classes → Subjects → Details  
- [ ] Class 9–10 only shows Matric teachers  
- [ ] Detail table shows Date / Subject / per-class teachers  
- [ ] Delete removes schedule from list  

### Papers from schedule

- [ ] Teacher Create Test → exam date locked to schedule date  
- [ ] Save succeeds without manually picking date  
- [ ] Schedule shows COMPLETED  
- [ ] Delete paper → schedule no longer COMPLETED (OVERDUE/PENDING/UPCOMING)  

---

## 10. Known limitations / notes

1. **One teacher type per account** — multi-level teaching needs a future design change.  
2. **Legacy papers** created before date-lock may still have exam date ≠ schedule date; UI warns on detail.  
3. **Delete teacher** permanently removes the user when they only belong to this org (cascades tests/assignments).  
4. Scheduling reminders exist (`npm run reminders:run` / cron route) but are out of scope for this smoke pass.  
5. Full edit/restructure of an existing schedule (change subjects/classes after create) is not built yet — create / cancel / delete only.

---

## 11. Demo login (if seed was used)

| Role | Email | Password |
|------|-------|----------|
| Super Admin | `admin@testgenerator.local` | `Admin@12345` |
| Teachers | (from demo seed) | `Teacher@12345` |
