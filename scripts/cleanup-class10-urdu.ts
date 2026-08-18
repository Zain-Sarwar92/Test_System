import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const prefix = "punjab-textbook:10:urdu-compulsory:";
  const deleted = await prisma.question.deleteMany({
    where: { externalKey: { startsWith: prefix } },
  });
  console.log(`Deleted ${deleted.count} Class 10 Urdu questions`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
