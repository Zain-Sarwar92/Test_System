/**
 * Check whether Exercise + Additional (and other priorities) exist in Neon.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ source: string | null; count: bigint }>
  >`
    SELECT source, COUNT(*)::bigint AS count
    FROM question
    GROUP BY source
    ORDER BY count DESC
  `;

  console.log("=== DB question.source breakdown ===");
  let exercise = 0;
  let additional = 0;
  let other = 0;
  for (const r of rows) {
    const n = Number(r.count);
    const s = r.source ?? "(null)";
    console.log(`${n}\t${s}`);
    const lower = s.toLowerCase();
    if (lower.includes("additional")) additional += n;
    else if (lower.includes("exercise") || lower.startsWith("e.x") || lower === "exercise")
      exercise += n;
    else other += n;
  }

  // Also match loose labels like "Review Exercise", conceptuals, past papers
  const buckets = await prisma.$queryRaw<
    Array<{ bucket: string; count: bigint }>
  >`
    SELECT
      CASE
        WHEN source ILIKE '%additional%' THEN 'Additional'
        WHEN source ILIKE '%exercise%' OR source ILIKE 'e.x%' THEN 'Exercise'
        WHEN source ILIKE '%conceptual%' THEN 'Conceptuals'
        WHEN source ILIKE '%past%paper%' THEN 'Past Papers'
        WHEN source ILIKE '%example%' THEN 'Examples'
        WHEN source IS NULL OR source = '' THEN 'Empty/null'
        ELSE 'Other'
      END AS bucket,
      COUNT(*)::bigint AS count
    FROM question
    GROUP BY 1
    ORDER BY count DESC
  `;

  console.log("\n=== Buckets ===");
  for (const b of buckets) {
    console.log(`${Number(b.count)}\t${b.bucket}`);
  }

  const total = await prisma.question.count();
  console.log(`\nTotal questions: ${total}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
