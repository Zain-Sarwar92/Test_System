import "dotenv/config";
import { auth } from "../src/lib/auth";
import { prisma } from "../src/lib/prisma";

async function main() {
  const org = await prisma.organization.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!org) {
    console.log("No organization found. Create one as Super Admin first.");
    return;
  }

  const email = "teacher@testgenerator.local";
  const password = "Teacher@12345";
  const name = "Demo Teacher";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing) {
    await auth.api.signUpEmail({
      body: { email, password, name },
    });
  }

  await prisma.user.update({
    where: { email },
    data: {
      role: "TEACHER",
      organizationId: org.id,
      isActive: true,
    },
  });

  console.log(`Teacher ready for org "${org.name}"`);
  console.log(`Login: ${email} / ${password}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
