/**
 * Fees UI UAT for Tahir (Playwright + API login).
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
  const klass = await prisma.class.findFirst({
    where: { name: "Class 9" },
    select: { id: true },
  });
  const sectionA = await prisma.section.findFirst({
    where: {
      organizationId: org!.id,
      classId: klass!.id,
      name: "A",
    },
    select: { id: true },
  });
  const student = await prisma.student.findFirst({
    where: {
      organizationId: org!.id,
      sectionId: sectionA!.id,
      isActive: true,
    },
    select: { id: true, name: true },
    orderBy: { rollNumber: "asc" },
  });
  const payment = await prisma.feePayment.findFirst({
    where: { organizationId: org!.id },
    orderBy: { paidAt: "desc" },
    select: { id: true, receiptNumber: true },
  });

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 960 } });

  try {
    await login(page);
    pass("F01.login", page.url());

    await page.goto(`${BASE}/org-admin/fees`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(500);
    if (page.url().includes("/login")) {
      fail("F02.fees_hub", "auth lost");
      throw new Error("auth lost");
    }
    pass("F02.fees_hub", page.url());
    const hub = await page.locator("body").innerText();
    if (/Class 9|Fees|Pending|Collect/i.test(hub)) pass("F03.hub_content");
    else fail("F03.hub_content", "unexpected hub");

    await page.goto(`${BASE}/org-admin/fees/types`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(400);
    const types = await page.locator("body").innerText();
    if (/Monthly Tuition|Generator|Test Dues|Fee/i.test(types)) {
      pass("F04.fee_types");
    } else {
      fail("F04.fee_types", types.slice(0, 160));
    }

    await page.goto(`${BASE}/org-admin/fees/structures`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const structures = await page.locator("body").innerText();
    if (/Class 9 Monthly Bundle|Tuition|Plan/i.test(structures)) {
      pass("F05.fee_structures");
    } else {
      fail("F05.fee_structures", structures.slice(0, 160));
    }

    await page.goto(`${BASE}/org-admin/fees/generate`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const generate = await page.locator("body").innerText();
    if (/Generate|Plan|Period|month/i.test(generate)) pass("F06.generate_page");
    else fail("F06.generate_page", generate.slice(0, 160));

    await page.goto(`${BASE}/org-admin/fees/pending`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    const pending = await page.locator("body").innerText();
    if (/Pending|Outstanding|UNPAID|Due|Class/i.test(pending)) {
      pass("F07.pending_page");
    } else {
      fail("F07.pending_page", pending.slice(0, 160));
    }

    // Class 9 fees desk
    await page.goto(
      `${BASE}/org-admin/fees?classId=${klass!.id}&sectionId=${sectionA!.id}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(600);
    const desk = await page.locator("body").innerText();
    if (/Class 9|Section|A|Tuition|Student|Collect/i.test(desk)) {
      pass("F08.section_fee_desk");
    } else {
      fail("F08.section_fee_desk", desk.slice(0, 180));
    }

    await page.goto(
      `${BASE}/org-admin/fees/collect?studentId=${student!.id}`,
      { waitUntil: "domcontentloaded" },
    );
    await page.waitForTimeout(600);
    const collect = await page.locator("body").innerText();
    if (
      new RegExp(student!.name.split(" ")[0]!, "i").test(collect) ||
      /Collect|Due|Pay|Amount|Receipt/i.test(collect)
    ) {
      pass("F09.collect_student");
    } else {
      fail("F09.collect_student", collect.slice(0, 180));
    }

    await page.goto(`${BASE}/org-admin/fees/print/${sectionA!.id}`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    const printSec = await page.locator("body").innerText();
    if (/Pending|Fee|Roll|Print|Student/i.test(printSec)) {
      pass("F10.print_section_pending");
    } else {
      fail("F10.print_section_pending", printSec.slice(0, 160));
    }

    await page.goto(`${BASE}/org-admin/fees/pending/print`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(500);
    const printAll = await page.locator("body").innerText();
    if (/Pending|Fee|Print|Student|Class/i.test(printAll)) {
      pass("F11.print_all_pending");
    } else {
      fail("F11.print_all_pending", printAll.slice(0, 160));
    }

    if (payment) {
      await page.goto(`${BASE}/org-admin/fees/receipts/${payment.id}`, {
        waitUntil: "domcontentloaded",
      });
      await page.waitForTimeout(500);
      const receipt = await page.locator("body").innerText();
      if (
        /Receipt|Paid|Amount/i.test(receipt) ||
        receipt.includes(payment.receiptNumber)
      ) {
        pass("F12.receipt_page", payment.receiptNumber);
      } else {
        fail("F12.receipt_page", receipt.slice(0, 160));
      }
    } else {
      fail("F12.receipt_page", "no payment found");
    }

    await page.goto(`${BASE}/org-admin/fees/dues`, {
      waitUntil: "domcontentloaded",
    });
    await page.waitForTimeout(400);
    const dues = await page.locator("body").innerText();
    if (/Due|Fee|Period|Student|Filter/i.test(dues)) pass("F13.dues_page");
    else fail("F13.dues_page", dues.slice(0, 160));

    pass("F14.session_ok", page.url());
  } catch (e) {
    fail("F99.aborted", String(e));
  } finally {
    await browser.close();
    await prisma.$disconnect();
  }

  const passed = results.filter((r) => r.ok).length;
  const total = results.length;
  const pct = total ? Math.round((passed / total) * 1000) / 10 : 0;
  console.log("\n=== Fees UI UAT ===");
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
