import "dotenv/config";
import { prisma } from "../src/lib/prisma";

const SECTION_NAMES = ["A", "B", "C"] as const;

async function main() {
  const org = await prisma.organization.findFirst({
    where: {
      OR: [
        { name: { contains: "tahir", mode: "insensitive" } },
        { slug: { contains: "tahir", mode: "insensitive" } },
      ],
    },
    select: { id: true, name: true, slug: true },
  });

  if (!org) {
    const all = await prisma.organization.findMany({
      select: { id: true, name: true, slug: true },
      orderBy: { name: "asc" },
    });
    console.error("Tahir organization not found. Available orgs:");
    console.error(JSON.stringify(all, null, 2));
    process.exit(1);
  }

  console.log(`Org: ${org.name} (${org.slug}) id=${org.id}`);

  const classes = await prisma.class.findMany({
    where: {
      OR: [
        { name: { equals: "Class 9", mode: "insensitive" } },
        { name: { equals: "Class 10", mode: "insensitive" } },
        { name: { equals: "9", mode: "insensitive" } },
        { name: { equals: "10", mode: "insensitive" } },
        { name: { contains: "Class 9", mode: "insensitive" } },
        { name: { contains: "Class 10", mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      name: true,
      board: { select: { name: true } },
    },
    orderBy: { name: "asc" },
  });

  // Prefer exact Class 9 / Class 10; avoid matching Class 11/12 via loose contains.
  const class9 = classes.find((c) => /^class\s*9$/i.test(c.name.trim()) || c.name.trim() === "9" || /^9th$/i.test(c.name.trim()));
  const class10 = classes.find((c) => /^class\s*10$/i.test(c.name.trim()) || c.name.trim() === "10" || /^10th$/i.test(c.name.trim()));

  if (!class9 || !class10) {
    console.error("Could not resolve Class 9 and Class 10. Found:");
    console.error(JSON.stringify(classes, null, 2));
    process.exit(1);
  }

  console.log(`Class 9: ${class9.name} (${class9.board.name}) id=${class9.id}`);
  console.log(`Class 10: ${class10.name} (${class10.board.name}) id=${class10.id}`);

  const targets = [
    { klass: class9, label: "Class 9" },
    { klass: class10, label: "Class 10" },
  ];

  const created: string[] = [];
  const skipped: string[] = [];

  for (const { klass, label } of targets) {
    for (const name of SECTION_NAMES) {
      const existing = await prisma.section.findUnique({
        where: {
          organizationId_classId_name: {
            organizationId: org.id,
            classId: klass.id,
            name,
          },
        },
        select: { id: true },
      });
      if (existing) {
        skipped.push(`${label} ${name}`);
        continue;
      }
      const row = await prisma.section.create({
        data: {
          organizationId: org.id,
          classId: klass.id,
          name,
        },
        select: { id: true, name: true },
      });
      created.push(`${label} ${row.name} (${row.id})`);
    }
  }

  const sections = await prisma.section.findMany({
    where: {
      organizationId: org.id,
      classId: { in: [class9.id, class10.id] },
    },
    select: {
      id: true,
      name: true,
      class: { select: { name: true } },
      _count: { select: { students: true, teacherAssignments: true } },
    },
    orderBy: [{ class: { name: "asc" } }, { name: "asc" }],
  });

  console.log("\n--- Result ---");
  console.log("Created:", created.length ? created.join(", ") : "(none)");
  console.log("Skipped (already existed):", skipped.length ? skipped.join(", ") : "(none)");
  console.log("\nSections for Class 9 & 10:");
  for (const s of sections) {
    console.log(
      `  ${s.class.name} / ${s.name} | students=${s._count.students} teachers=${s._count.teacherAssignments} | ${s.id}`,
    );
  }

  // --- Basic integrity tests ---
  const failures: string[] = [];

  for (const { klass, label } of targets) {
    for (const name of SECTION_NAMES) {
      const found = sections.find((s) => s.class.name === klass.name && s.name === name);
      if (!found) failures.push(`Missing section ${label} ${name}`);
    }
  }

  // Unique constraint: same name+class+org must not duplicate
  const keys = sections.map((s) => `${s.class.name}::${s.name}`);
  const dupes = keys.filter((k, i) => keys.indexOf(k) !== i);
  if (dupes.length) failures.push(`Duplicate sections: ${dupes.join(", ")}`);

  // Cross-class same name is allowed (Class 9 A and Class 10 A)
  const a9 = sections.filter((s) => s.name === "A");
  if (a9.length < 2) failures.push("Expected section A on both Class 9 and Class 10");

  // Org isolation: sections must belong to Tahir only
  const wrongOrg = await prisma.section.count({
    where: {
      id: { in: sections.map((s) => s.id) },
      NOT: { organizationId: org.id },
    },
  });
  if (wrongOrg > 0) failures.push("Section(s) linked to wrong organization");

  // Duplicate create should fail (unique)
  try {
    await prisma.section.create({
      data: { organizationId: org.id, classId: class9.id, name: "A" },
    });
    failures.push("Expected unique constraint error on duplicate Class 9 A");
  } catch {
    console.log("\nOK: duplicate Class 9 / A rejected by unique constraint");
  }

  console.log("\n--- Tests ---");
  if (failures.length) {
    console.error("FAILED:");
    for (const f of failures) console.error(" -", f);
    process.exit(1);
  }
  console.log("PASSED: sections present, unique, org-scoped, cross-class names OK");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
