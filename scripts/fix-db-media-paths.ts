/**
 * Normalize media paths inside Neon question rows:
 * /pts-equations/ → /pts-media/equations/
 * /Equations/ → /pts-media/equations/
 * /Diagrams|Images|.../ → /pts-media/...
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const fields = [
    "text",
    '"textUrdu"',
    '"optionA"',
    '"optionB"',
    '"optionC"',
    '"optionD"',
  ];

  for (const field of fields) {
    const r1 = await prisma.$executeRawUnsafe(`
      UPDATE question
      SET ${field} = REPLACE(${field}, '/pts-equations/', '/pts-media/equations/')
      WHERE ${field} LIKE '%/pts-equations/%'
    `);
    const r2 = await prisma.$executeRawUnsafe(`
      UPDATE question
      SET ${field} = REPLACE(${field}, '/Equations/', '/pts-media/equations/')
      WHERE ${field} LIKE '%/Equations/%'
        AND ${field} NOT LIKE '%/pts-media/equations/%'
    `);
    const r3 = await prisma.$executeRawUnsafe(`
      UPDATE question
      SET ${field} = REPLACE(${field}, 'src="/Diagrams/', 'src="/pts-media/Diagrams/')
      WHERE ${field} LIKE '%src="/Diagrams/%'
    `);
    console.log({ field, ptsEquations: r1, absoluteEquations: r2, diagrams: r3 });
  }

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
  console.log("\nDB media buckets after fix:");
  for (const r of rows) console.log(`${Number(r.count)}\t${r.bucket}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
