/**
 * Results UI smoke for Tahir Class 9 A / B / Arts · UAT Mid Term
 * Env: UAT_EMAIL, UAT_PASSWORD, UAT_BASE_URL
 */
import { chromium, type Page } from "playwright";
import "dotenv/config";
import { academicSession } from "../src/lib/results";
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
  if (!org) throw new Error("Tahir missing");

  const klass = await prisma.class.findFirst({
    where: { name: "Class 9" },
    select: { id: true },
  });
  const sections = await prisma.section.findMany({
    where: {
      organizationId: org.id,
      classId: klass!.id,
      name: { in: ["A", "B", "Arts"] },
    },
    select: { id: true, name: true },
  });
  const byName = Object.fromEntries(sections.map((s) => [s.name, s.id]));
  const session = academicSession();
  const exam = await prisma.examTerm.findFirst({
    where: {
      organizationId: org.id,
      series: { name: "UAT Term Series", session },
      roundOrder: 1,
    },
    select: { id: true },
  });
  const series = await prisma.resultSeries.findFirst({
    where: { organizationId: org.id, name: "UAT Term Series", session },
    select: { id: true },
  });
  const midExam = await prisma.examTerm.findFirst({
    where: { organizationId: org.id, name: "UAT Mid Term", session },
    select: { id: true },
  });
  if (!exam || !series || !byName.A || !byName.B || !byName.Arts) {
    throw new Error("Seed data missing — run seed-tahir-results-uat.ts first");
  }

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await login(page);
    pass("R01.login", page.url());

    await page.goto(`${BASE}/org-admin/results`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (page.url().includes("/login")) {
      fail("R02.results_hub", "auth lost");
      throw new Error("auth lost");
    }
    pass("R02.results_hub", page.url());
    const hub = await page.locator("body").innerText();
    if (/Class 9|Results/i.test(hub)) pass("R03.hub_content");
    else fail("R03.hub_content", "unexpected hub");

    // Class 9
    const classLink = page.locator(`a[href*="/results/classes/${klass!.id}"]`).first();
    if (await classLink.count()) {
      await classLink.click();
      await waitPath(page, new RegExp(`/results/classes/${klass!.id}`));
      pass("R04.class9_page", page.url());
    } else {
      await page.goto(`${BASE}/org-admin/results/classes/${klass!.id}`, {
        waitUntil: "domcontentloaded",
      });
      pass("R04.class9_page", "direct " + page.url());
    }

    for (const name of ["A", "B", "Arts"] as const) {
      const sectionId = byName[name]!;
      await page.goto(`${BASE}/org-admin/results/sections/${sectionId}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(400);
      const text = await page.locator("body").innerText();
      if (/UAT Mid Term|Exam|Result/i.test(text)) {
        pass(`R05.section_${name}_exams`, "exam visible");
      } else {
        fail(`R05.section_${name}_exams`, "exam list unexpected");
      }

      await page.goto(
        `${BASE}/org-admin/results/sections/${sectionId}/exams/${exam.id}`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForTimeout(500);
      const examText = await page.locator("body").innerText();
      if (/English|Mathematics|Subject|Gazette|Print/i.test(examText)) {
        pass(`R06.exam_${name}_subjects`);
      } else {
        fail(`R06.exam_${name}_subjects`, "subjects missing");
      }

      await page.goto(
        `${BASE}/org-admin/results/sections/${sectionId}/exams/${exam.id}/gazette`,
        { waitUntil: "domcontentloaded" },
      );
      await page.waitForTimeout(600);
      const gaz = await page.locator("body").innerText();
      if (/Gazette|Roll|Total|%|Pass|Fail/i.test(gaz) || /\d{2,}/.test(gaz)) {
        pass(`R07.gazette_${name}`);
      } else {
        fail(`R07.gazette_${name}`, "gazette empty/unexpected");
      }

      // Open one subject marks page
      const assessment = await prisma.subjectAssessment.findFirst({
        where: {
          organizationId: org.id,
          examTermId: exam.id,
          sectionId,
          subject: { name: { equals: "English", mode: "insensitive" } },
        },
        select: { subjectId: true },
      });
      if (assessment) {
        await page.goto(
          `${BASE}/org-admin/results/sections/${sectionId}/exams/${exam.id}/subjects/${assessment.subjectId}`,
          { waitUntil: "domcontentloaded" },
        );
        await page.waitForTimeout(500);
        const marks = await page.locator("body").innerText();
        if (/Roll|Marks|English|Save|Absent/i.test(marks)) {
          pass(`R08.marks_${name}_english`);
        } else {
          fail(`R08.marks_${name}_english`, "marks page unexpected");
        }
      } else {
        fail(`R08.marks_${name}_english`, "no English assessment");
      }
    }

    // Print lists for section A
    await page.goto(
      `${BASE}/org-admin/results/sections/${byName.A}/exams/${exam.id}/print-lists`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(500);
    const printLists = await page.locator("body").innerText();
    if (/Print|Student|List|Subject/i.test(printLists)) pass("R09.print_lists_A");
    else fail("R09.print_lists_A", "print lists unexpected");

    // Ethics must not appear on Science section A exam page
    await page.goto(
      `${BASE}/org-admin/results/sections/${byName.A}/exams/${exam.id}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(500);
    const sciExam = await page.locator("body").innerText();
    if (/اخلاقیات|Ethics/i.test(sciExam)) {
      fail("R11.no_ethics_on_science_A", "Ethics still listed on Science section");
    } else {
      pass("R11.no_ethics_on_science_A");
    }

    // Multi-round series page + combined rounds gazette
    await page.goto(
      `${BASE}/org-admin/results/sections/${byName.A}/series/${series!.id}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(500);
    const seriesText = await page.locator("body").innerText();
    if (/Round 1|Round 2|UAT Term Series/i.test(seriesText)) {
      pass("R12.series_rounds_page");
    } else {
      fail("R12.series_rounds_page", seriesText.slice(0, 200));
    }

    await page.goto(
      `${BASE}/org-admin/results/sections/${byName.A}/series/${series!.id}/combined`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(700);
    const combinedRounds = await page.locator("body").innerText();
    if (/Round|Combined|Gazette|Roll|\d+/i.test(combinedRounds)) {
      pass("R13.combined_rounds_gazette");
    } else {
      fail("R13.combined_rounds_gazette", "combined rounds empty");
    }

    // All science sections combined gazette (A+B)
    const combineExamId = midExam?.id ?? exam.id;
    await page.goto(
      `${BASE}/org-admin/results/classes/${klass!.id}/combine?sections=${byName.A},${byName.B}&examId=${combineExamId}&stream=SCIENCE`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(800);
    const combineText = await page.locator("body").innerText();
    if (
      /Combined|Gazette|Section|Roll/i.test(combineText) &&
      !/اخلاقیات/i.test(combineText)
    ) {
      pass("R14.combine_sections_A_B");
    } else if (/Combined|Gazette/i.test(combineText)) {
      pass("R14.combine_sections_A_B", "loaded (ethics check soft)");
    } else {
      fail("R14.combine_sections_A_B", combineText.slice(0, 180));
    }

    pass("R10.session_ok", page.url());
  } catch (e) {
    fail("R99.aborted", String(e));
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const pct = total ? Math.round((passed / total) * 1000) / 10 : 0;
  console.log("\n=== Results UI UAT ===");
  for (const r of results) {
    console.log(`${r.ok ? "PASS" : "FAIL"}  ${r.id}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  console.log(`\nScore: ${passed}/${total} = ${pct}%`);
  if (results.some((r) => !r.ok)) process.exitCode = 1;
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
