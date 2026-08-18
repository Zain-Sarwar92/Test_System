import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const deleted = await prisma.question.deleteMany({
    where: { externalKey: { startsWith: "punjab-textbook:12:urdu-compulsory:" } },
  });
  console.log(`Deleted ${deleted.count} Class 12 Urdu questions`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
