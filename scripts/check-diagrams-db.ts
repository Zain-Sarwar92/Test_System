import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT bucket, COUNT(*)::bigint AS count FROM (
      SELECT
        CASE
          WHEN text ILIKE '%Diagrams/%' OR text ILIKE '%/pts-media/Diagrams/%'
            OR COALESCE("textUrdu",'') ILIKE '%Diagrams/%'
            OR COALESCE("optionA",'') ILIKE '%Diagrams/%'
            OR COALESCE("optionB",'') ILIKE '%Diagrams/%'
            OR COALESCE("optionC",'') ILIKE '%Diagrams/%'
            OR COALESCE("optionD",'') ILIKE '%Diagrams/%'
            THEN 'has_diagram'
          WHEN text ILIKE '%Equations/%' OR text ILIKE '%/pts-media/equations/%'
            OR COALESCE("textUrdu",'') ILIKE '%Equations/%'
            OR COALESCE("optionA",'') ILIKE '%Equations/%'
            OR COALESCE("optionB",'') ILIKE '%Equations/%'
            OR COALESCE("optionC",'') ILIKE '%Equations/%'
            OR COALESCE("optionD",'') ILIKE '%Equations/%'
            THEN 'has_equation'
          WHEN text ILIKE '%<img%'
            OR COALESCE("textUrdu",'') ILIKE '%<img%'
            OR COALESCE("optionA",'') ILIKE '%<img%'
            OR COALESCE("optionB",'') ILIKE '%<img%'
            OR COALESCE("optionC",'') ILIKE '%<img%'
            OR COALESCE("optionD",'') ILIKE '%<img%'
            THEN 'has_other_img'
          ELSE 'no_media'
        END AS bucket
      FROM question
    ) t
    GROUP BY bucket
    ORDER BY count DESC
  `;

  console.log("=== DB media buckets ===");
  for (const r of rows) console.log(`${Number(r.count)}\t${r.bucket}`);

  const sample = await prisma.question.findFirst({
    where: {
      OR: [
        { text: { contains: "Diagrams/", mode: "insensitive" } },
        { text: { contains: "/pts-media/Diagrams/", mode: "insensitive" } },
      ],
    },
    select: { id: true, text: true, source: true },
  });
  console.log("\nSample diagram question id:", sample?.id);
  console.log("Sample source:", sample?.source);
  console.log("Sample snippet:", sample?.text?.slice(0, 300));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
