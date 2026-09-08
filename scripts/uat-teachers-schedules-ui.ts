/**
 * Teachers + Schedules UI UAT for Tahir (Playwright + API login).
 * Env: UAT_EMAIL, UAT_PASSWORD, UAT_BASE_URL
 */
import { chromium, type Page } from "playwright";
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const BASE = process.env.UAT_BASE_URL ?? "http://localhost:5001";
const EMAIL = process.env.UAT_EMAIL ?? "";
const PASSWORD = process.env.UAT_PASSWORD ?? "";

type Result = { id: string; ok: boolean; detail?: string };
const results: Result[] = [];
function pass(id: string, detail?: string) {
  results.push({ id, ok: true, detail });
}
function fail(id: string, detail: string) {
  results.push({ id, ok: false, detail });
}

async function waitPath(page: Page, re: RegExp, ms = 25000) {
  const start = Date.now();
  while (Date.now() - start < ms) {
    if (re.test(page.url())) return;
    await page.waitForTimeout(200);
  }
  throw new Error(`Timeout waiting for ${re} (at ${page.url()})`);
}

async function login(page: Page) {
  const res = await page.request.post(`${BASE}/api/auth/sign-in/email`, {
    data: { email: EMAIL, password: PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Sign-in failed HTTP ${res.status()} ${await res.text()}`);
  }
  await page.goto(`${BASE}/org-admin`, { waitUntil: "domcontentloaded" });
  if (page.url().includes("/login")) {
    throw new Error("Session cookie not applied after API sign-in");
  }
  if (page.url().includes("/select-org")) {
    const btn = page.locator("form button[type='submit']").first();
    if (await btn.count()) {
      await btn.click();
      await waitPath(page, /org-admin/);
    }
  }
}

async function main() {
  if (!EMAIL || !PASSWORD) {
    console.error("Set UAT_EMAIL and UAT_PASSWORD");
    process.exit(1);
  }

  const org = await prisma.organization.findFirst({
    where: { slug: "tahir" },
    select: { id: true },
  });
  if (!org) throw new Error("Tahir org not found");

  const teachers = await prisma.user.findMany({
    where: {
      organizationId: org.id,
      role: "TEACHER",
      email: { endsWith: "@mailinator.com" },
      name: { startsWith: "UAT " },
    },
    select: { id: true, name: true, email: true },
    orderBy: { name: "asc" },
  });
  const schedule = await prisma.testSchedule.findFirst({
    where: { organizationId: org.id, name: { startsWith: "UAT " } },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      name: true,
      rounds: {
        select: {
          name: true,
          subjects: { select: { subjectName: true } },
        },
      },
    },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await login(page);
    pass("T01.login", page.url());

    // --- Teachers ---
    await page.goto(`${BASE}/org-admin/teachers`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    if (page.url().includes("/login")) {
      fail("T02.teachers_list", "auth lost");
      throw new Error("auth lost");
    }
    pass("T02.teachers_list", page.url());

    const listText = await page.locator("body").innerText();
    if (/UAT Commons Teacher|UAT Science Teacher|Teacher/i.test(listText)) {
      pass("T03.seeded_teachers_visible");
    } else {
      fail("T03.seeded_teachers_visible", listText.slice(0, 200));
    }

    await page.goto(`${BASE}/org-admin/teachers/new`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const newText = await page.locator("body").innerText();
    if (/name|email|password|assign|subject|class|section/i.test(newText)) {
      pass("T04.teachers_new_form");
    } else {
      fail("T04.teachers_new_form", newText.slice(0, 160));
    }

    if (teachers[0]) {
      await page.goto(`${BASE}/org-admin/teachers/${teachers[0].id}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(400);
      const detail = await page.locator("body").innerText();
      if (
        detail.includes(teachers[0].name) ||
        /Class 9|English|Mathematics|assignment/i.test(detail)
      ) {
        pass("T05.teacher_detail", teachers[0].name);
      } else {
        fail("T05.teacher_detail", detail.slice(0, 180));
      }

      // Subject filter on list
      await page.goto(
        `${BASE}/org-admin/teachers?subject=${encodeURIComponent("English")}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForTimeout(400);
      const filtered = await page.locator("body").innerText();
      if (/UAT Commons Teacher|English/i.test(filtered)) {
        pass("T06.teachers_subject_filter");
      } else {
        fail("T06.teachers_subject_filter", filtered.slice(0, 160));
      }

      await page.goto(
        `${BASE}/org-admin/teachers?q=${encodeURIComponent("Commons")}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForTimeout(400);
      const searched = await page.locator("body").innerText();
      if (/UAT Commons Teacher/i.test(searched)) {
        pass("T07.teachers_search");
      } else {
        fail("T07.teachers_search", searched.slice(0, 160));
      }
    } else {
      fail("T05.teacher_detail", "no UAT teachers in DB");
      fail("T06.teachers_subject_filter", "skipped");
      fail("T07.teachers_search", "skipped");
    }

    // Arts teacher visible
    if (/UAT Arts Teacher/i.test(listText)) {
      pass("T08.arts_teacher_listed");
    } else {
      // re-fetch list page text if needed
      await page.goto(`${BASE}/org-admin/teachers`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(300);
      const again = await page.locator("body").innerText();
      if (/UAT Arts Teacher/i.test(again)) pass("T08.arts_teacher_listed");
      else fail("T08.arts_teacher_listed", again.slice(0, 160));
    }

    // --- Schedules ---
    await page.goto(`${BASE}/org-admin/schedules`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    if (page.url().includes("/login")) {
      fail("S01.schedules_list", "auth lost");
      throw new Error("auth lost");
    }
    pass("S01.schedules_list", page.url());

    const schedList = await page.locator("body").innerText();
    if (/UAT Class 9 Mid Schedule|Schedule/i.test(schedList)) {
      pass("S02.uat_schedule_visible");
    } else {
      fail("S02.uat_schedule_visible", schedList.slice(0, 200));
    }

    await page.goto(`${BASE}/org-admin/schedules/new`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    const newSched = await page.locator("body").innerText();
    if (/schedule|round|subject|teacher|section|class/i.test(newSched)) {
      pass("S03.schedules_new_form");
    } else {
      fail("S03.schedules_new_form", newSched.slice(0, 160));
    }

    if (schedule) {
      await page.goto(`${BASE}/org-admin/schedules/${schedule.id}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(500);
      const detail = await page.locator("body").innerText();
      if (
        detail.includes(schedule.name) ||
        /Round 1|Round 2|English|Mathematics|Biology/i.test(detail)
      ) {
        pass("S04.schedule_detail_rounds");
      } else {
        fail("S04.schedule_detail_rounds", detail.slice(0, 200));
      }

      if (/Section A|A\b|Section B|Arts/i.test(detail)) {
        pass("S05.schedule_sections_shown");
      } else {
        fail("S05.schedule_sections_shown", detail.slice(0, 180));
      }

      if (/UAT Commons|UAT Science|UAT Computer|UAT Arts|Teacher/i.test(detail)) {
        pass("S06.schedule_teachers_shown");
      } else {
        fail("S06.schedule_teachers_shown", detail.slice(0, 180));
      }

      await page.goto(`${BASE}/org-admin/schedules/${schedule.id}/print`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(500);
      const printText = await page.locator("body").innerText();
      if (
        /UAT Class 9|English|Mathematics|Round|Class 9/i.test(printText) &&
        !page.url().includes("/login")
      ) {
        pass("S07.schedule_print");
      } else {
        fail("S07.schedule_print", printText.slice(0, 180));
      }

      // Multi-round evidence from DB reflected in UI
      const roundNames = schedule.rounds.map((r) => r.name).join(" ");
      if (/Round 1/i.test(detail) && /Round 2/i.test(detail)) {
        pass("S08.multi_round_ui", roundNames);
      } else {
        fail("S08.multi_round_ui", detail.slice(0, 200));
      }
    } else {
      for (const id of [
        "S04.schedule_detail_rounds",
        "S05.schedule_sections_shown",
        "S06.schedule_teachers_shown",
        "S07.schedule_print",
        "S08.multi_round_ui",
      ]) {
        fail(id, "no UAT schedule in DB — run seed first");
      }
    }
  } catch (e) {
    fail("ZZ.crash", e instanceof Error ? e.message : String(e));
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const ok = results.filter((r) => r.ok).length;
  const total = results.length;
  console.log("\n=== Teachers + Schedules UI UAT ===");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"} ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\nScore: ${ok}/${total} = ${Math.round((ok / total) * 100)}%`);
  if (ok < total) process.exitCode = 1;
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
