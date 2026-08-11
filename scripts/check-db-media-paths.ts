import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<Array<{ bucket: string; count: bigint }>>`
    SELECT bucket, COUNT(*)::bigint AS count FROM (
      SELECT CASE
        WHEN text ILIKE '%/pts-media/%' THEN 'pts-media'
        WHEN text ILIKE '%/pts-equations/%' THEN 'pts-equations'
        WHEN text ILIKE '%/Equations/%' THEN 'absolute-Equations'
        WHEN text ILIKE '%/Diagrams/%' THEN 'absolute-Diagrams'
        WHEN text ILIKE '%<img%' THEN 'img-other'
        ELSE 'no-img'
      END AS bucket
      FROM question
    ) t
    GROUP BY 1
    ORDER BY count DESC
  `;
  for (const r of rows) console.log(`${Number(r.count)}\t${r.bucket}`);

  const sampleEq = await prisma.question.findFirst({
    where: { text: { contains: "<img", mode: "insensitive" } },
    select: { id: true, text: true },
  });
  console.log("\nSample img snippet:", sampleEq?.text?.slice(0, 250));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
