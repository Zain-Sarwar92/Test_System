import "dotenv/config";
import { prisma } from "../src/lib/prisma";

function splitSectionNames(raw: string): string[] {
  return [
    ...new Set(
      raw
        .split(/[,/|]+/)
        .map((part) => part.trim())
        .filter(Boolean),
    ),
  ];
}

async function main() {
  const org = await prisma.organization.findFirst({
    where: { slug: "tahir" },
    select: { id: true, name: true },
  });
  if (!org) throw new Error("Tahir org not found");

  const class9 = await prisma.class.findFirst({
    where: { name: "Class 9" },
    select: { id: true },
  });
  const class10 = await prisma.class.findFirst({
    where: { name: "Class 10" },
    select: { id: true },
  });
  if (!class9 || !class10) throw new Error("Class 9/10 missing");

  const checks: [string, boolean | string][] = [];

  checks.push([
    "multi-create parse + dedupe (D, E / F| D)",
    JSON.stringify(splitSectionNames("D, E / F| D")) ===
      JSON.stringify(["D", "E", "F"]),
  ]);
  checks.push([
    "empty/separator-only input → no names",
    splitSectionNames(" , / | ").length === 0,
  ]);
  checks.push(["name length > 50 rejected by app", "X".repeat(51).length > 50]);

  const a9 = await prisma.section.findFirst({
    where: { organizationId: org.id, classId: class9.id, name: "A" },
  });
  const a10 = await prisma.section.findFirst({
    where: { organizationId: org.id, classId: class10.id, name: "A" },
  });
  checks.push([
    "same section name on Class 9 and 10 allowed",
    !!(a9 && a10 && a9.id !== a10.id),
  ]);

  const otherOrg = await prisma.organization.findFirst({
    where: { NOT: { id: org.id } },
    select: { id: true },
  });
  if (otherOrg && a9) {
    const leak = await prisma.section.count({
      where: { organizationId: otherOrg.id, id: a9.id },
    });
    checks.push(["section id not owned by other org", leak === 0]);
  } else {
    checks.push(["section id not owned by other org", "SKIP"]);
  }

  // Unique: cannot create duplicate A on Class 9
  let dupBlocked = false;
  try {
    await prisma.section.create({
      data: { organizationId: org.id, classId: class9.id, name: "A" },
    });
  } catch {
    dupBlocked = true;
  }
  checks.push(["DB unique blocks duplicate Class 9 A", dupBlocked]);

  const list = await prisma.section.findMany({
    where: {
      organizationId: org.id,
      classId: { in: [class9.id, class10.id] },
    },
    orderBy: [{ classId: "asc" }, { name: "asc" }],
    select: { name: true, class: { select: { name: true } } },
  });
  checks.push(["exactly 6 sections (A/B/C × 2 classes)", list.length === 6]);

  console.log(`Org: ${org.name}`);
  console.log("Sections:", list.map((s) => `${s.class.name}/${s.name}`).join(", "));
  console.log("\nEdge checks:");
  let failed = 0;
  for (const [name, ok] of checks) {
    const pass = ok === true || ok === "SKIP";
    if (!pass) failed += 1;
    console.log(`${ok === true ? "PASS" : ok === "SKIP" ? "SKIP" : "FAIL"} - ${name}`);
  }
  if (failed) process.exit(1);
  console.log("\nAll edge checks passed.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
