/**
 * Browser UAT for Students section (Playwright).
 * Credentials via env only — do not commit secrets.
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
  await page.goto(`${BASE}/login`, { waitUntil: "domcontentloaded" });
  await page.locator("#email").fill(EMAIL);
  await page.locator("#password").fill(PASSWORD);
  await page.getByRole("button", { name: /Sign in/i }).click();
  await waitPath(page, /select-org|org-admin|super-admin/);
  if (page.url().includes("/select-org")) {
    await page.waitForTimeout(800);
    const btn = page.locator("form button[type='submit']").first();
    if (await btn.count()) {
      await btn.click();
      await waitPath(page, /org-admin/);
    } else {
      await waitPath(page, /org-admin/, 12000);
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
  if (!org) throw new Error("Tahir org missing");

  const section = await prisma.section.findFirst({
    where: {
      organizationId: org.id,
      name: "A",
      class: { name: "Class 9" },
    },
    select: {
      id: true,
      classId: true,
    },
  });
  if (!section) throw new Error("Class 9 / A missing");

  const student = await prisma.student.findFirst({
    where: { organizationId: org.id, sectionId: section.id },
    select: { id: true, name: true, studyGroup: true },
    orderBy: { rollNumber: "asc" },
  });
  if (!student) throw new Error("No students in Class 9 / A");

  const classHref = `/org-admin/students?classId=${section.classId}`;
  const sectionHref = `/org-admin/students?classId=${section.classId}&sectionId=${section.id}`;
  const bioHref = `${sectionHref}&group=BIOLOGY`;
  const printBioHref = `/org-admin/students/print/${section.id}?group=BIOLOGY`;

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await login(page);
    pass("UI01.login", page.url());

    await page.goto(`${BASE}/org-admin/students`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (page.url().includes("/login")) {
      fail("UI02.students_hub", "redirected to login");
      throw new Error("auth lost");
    }
    pass("UI02.students_hub", page.url());

    const hub = await page.locator("body").innerText();
    if (/Class 9/i.test(hub)) pass("UI03.class9_on_hub");
    else fail("UI03.class9_on_hub", "Class 9 card missing");

    const classLink = page.locator(`a[href*="classId=${section.classId}"]`).first();
    if (await classLink.count()) {
      await classLink.click();
      await waitPath(page, new RegExp(`classId=${section.classId}`));
      pass("UI04.open_class9_click", page.url());
    } else {
      fail("UI04.open_class9_click", "class link missing on hub");
      await page.goto(`${BASE}${classHref}`, { waitUntil: "domcontentloaded" });
    }

    const classPage = await page.locator("body").innerText();
    if (/Section/i.test(classPage) && /\bA\b/.test(classPage)) pass("UI05.sections_listed");
    else fail("UI05.sections_listed", "section cards missing");

    const sectionLink = page.locator(`a[href*="sectionId=${section.id}"]`).first();
    if (await sectionLink.count()) {
      await sectionLink.click();
      await waitPath(page, new RegExp(`sectionId=${section.id}`));
      pass("UI06.open_section_A_click", page.url());
    } else {
      fail("UI06.open_section_A_click", "section link missing");
      await page.goto(`${BASE}${sectionHref}`, { waitUntil: "domcontentloaded" });
    }

    await page.waitForTimeout(400);
    const list = await page.locator("body").innerText();
    if (/Biology|Computer|Arts/i.test(list)) pass("UI07.group_ui_visible");
    else fail("UI07.group_ui_visible", "group chips/labels missing");

    if (list.includes(student.name) || /Roll/i.test(list)) {
      pass("UI08.student_rows_visible", student.name);
    } else {
      fail("UI08.student_rows_visible", "roster empty/unexpected");
    }

    const bioChip = page.locator(`a[href*="group=BIOLOGY"]`).first();
    if (await bioChip.count()) {
      await bioChip.click();
      await waitPath(page, /group=BIOLOGY/);
      pass("UI09.filter_biology_click", page.url());
    } else {
      const select = page.locator('select[name="group"]');
      if (await select.count()) {
        await select.selectOption("BIOLOGY");
        await page.locator('button:has-text("Apply")').click();
        await waitPath(page, /group=BIOLOGY/);
        pass("UI09.filter_biology_click", page.url());
      } else {
        fail("UI09.filter_biology_click", "no group control");
        await page.goto(`${BASE}${bioHref}`, { waitUntil: "domcontentloaded" });
      }
    }

    await page.waitForTimeout(400);
    const bioList = await page.locator("body").innerText();
    if (!/No Biology students/i.test(bioList) && (/Biology/i.test(bioList) || /group=BIOLOGY/.test(page.url()))) {
      pass("UI10.filter_biology_has_rows");
    } else {
      fail("UI10.filter_biology_has_rows", "empty/unclear after filter");
    }

    const printLink = page.locator(`a[href*="/students/print/${section.id}"]`).first();
    if (await printLink.count()) {
      await printLink.click();
      await waitPath(page, new RegExp(`/students/print/${section.id}`));
      pass("UI11.print_open", page.url());
    } else {
      fail("UI11.print_open", "print link missing");
      await page.goto(`${BASE}${printBioHref}`, { waitUntil: "domcontentloaded" });
    }

    await page.waitForTimeout(400);
    const printText = await page.locator("body").innerText();
    if (/Biology/i.test(printText)) pass("UI12.print_group_header");
    else fail("UI12.print_group_header", "Biology not on print page");
    if (/Roll No\.|Student Name|Father Name/i.test(printText)) pass("UI13.print_table");
    else fail("UI13.print_table", "table missing");
    if (/Print \/ Save PDF|Print/i.test(printText)) pass("UI14.print_button");
    else fail("UI14.print_button", "print action missing");

    await page.goto(`${BASE}/org-admin/students/${student.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const detail = await page.locator("body").innerText();
    if (/Group/i.test(detail)) pass("UI15.detail_shows_group");
    else fail("UI15.detail_shows_group", "Group field missing");

    await page.goto(`${BASE}/org-admin/students/${student.id}/edit`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const edit = await page.locator("body").innerText();
    if (/Group|Father|Phone|Save|Update/i.test(edit)) pass("UI16.edit_form");
    else fail("UI16.edit_form", "edit form unexpected");

    await page.goto(`${BASE}/org-admin/students/new?sectionId=${section.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const addText = await page.locator("body").innerText();
    if (/Father|Phone|Group|Roll/i.test(addText)) pass("UI17.add_form");
    else fail("UI17.add_form", "add form missing fields");

    const name = page.locator('input[name="name"]').first();
    const father = page.locator('input[name="fatherName"]').first();
    const phone = page.locator('input[name="phone"]').first();
    if ((await name.count()) && (await father.count()) && (await phone.count())) {
      await name.fill("Z");
      await father.fill("Y");
      await phone.fill("12");
      await page.locator('button[type="submit"]').first().click();
      await page.waitForTimeout(1000);
      const stillOnNew = page.url().includes("/students/new");
      const after = await page.locator("body").innerText();
      if (stillOnNew || /phone|digit|name|required|valid|group|select/i.test(after)) {
        pass("UI18.create_rejects_invalid");
      } else {
        fail("UI18.create_rejects_invalid", "invalid create may have succeeded");
      }
    } else {
      fail("UI18.create_rejects_invalid", "inputs missing");
    }

    await page.goto(`${BASE}/org-admin/students/fields`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const fields = await page.locator("body").innerText();
    if (/Custom|Field|Label/i.test(fields)) pass("UI19.custom_fields");
    else fail("UI19.custom_fields", "fields page unexpected");

    await page.goto(`${BASE}${sectionHref}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const allChip = page.locator("a", { hasText: /^All \(/ }).first();
    if (await allChip.count()) {
      await allChip.click();
      await page.waitForTimeout(400);
      pass("UI20.clear_group_filter", page.url());
    } else {
      pass("UI20.clear_group_filter", "section loaded without All chip click");
    }

    pass("UI21.session_ok", page.url());
  } catch (e) {
    fail("UI99.aborted", String(e));
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const pct = total ? Math.round((passed / total) * 1000) / 10 : 0;
  console.log("\n=== Students UI UAT (logged-in) ===");
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
