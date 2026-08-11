import "dotenv/config";
import { createCredentialUser, setCredentialPassword } from "../src/lib/create-credential-user";
import { prisma } from "../src/lib/prisma";
import { importLahoreBiologyQuestionBank } from "../scripts/import-lahore-biology";

async function main() {
  const email = process.env.SEED_SUPER_ADMIN_EMAIL;
  const password = process.env.SEED_SUPER_ADMIN_PASSWORD;
  const name = process.env.SEED_SUPER_ADMIN_NAME ?? "Super Admin";

  if (!email || !password) {
    throw new Error("SEED_SUPER_ADMIN_EMAIL and SEED_SUPER_ADMIN_PASSWORD are required");
  }
  if (password === "Admin@12345" || password.length < 12) {
    throw new Error("SEED_SUPER_ADMIN_PASSWORD must be strong (12+ chars, not the default)");
  }

  const existing = await prisma.user.findUnique({ where: { email } });

  if (!existing) {
    await createCredentialUser({ email, password, name });
  } else {
    await setCredentialPassword(existing.id, password);
  }

  await prisma.user.update({
    where: { email },
    data: {
      role: "SUPER_ADMIN",
      isActive: true,
      organizationId: null,
      name,
    },
  });

  console.log("Seed complete");
  console.log(`Super Admin: ${email}`);
  console.log("Password: (from SEED_SUPER_ADMIN_PASSWORD — not printed)");

  const usersWithOrg = await prisma.user.findMany({
    where: { organizationId: { not: null }, role: { not: "SUPER_ADMIN" } },
    select: { id: true, organizationId: true, role: true },
  });
  for (const u of usersWithOrg) {
    if (!u.organizationId) continue;
    await prisma.orgMembership.upsert({
      where: { userId_organizationId: { userId: u.id, organizationId: u.organizationId } },
      create: {
        userId: u.id,
        organizationId: u.organizationId,
        role: u.role,
        isActive: true,
      },
      update: {},
    });
  }
  console.log(`Backfilled ${usersWithOrg.length} org memberships`);

  const imported = await importLahoreBiologyQuestionBank();
  console.log("Lahore Board 9th Biology import:", imported);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
