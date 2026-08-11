import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  await prisma.systemSetting.upsert({
    where: { key: "platform_name" },
    create: { key: "platform_name", value: "Test Hub" },
    update: { value: "Test Hub" },
  });
  const row = await prisma.systemSetting.findUnique({
    where: { key: "platform_name" },
  });
  console.log("Neon platform_name =", row?.value);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
