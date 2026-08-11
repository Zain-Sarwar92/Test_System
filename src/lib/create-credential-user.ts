import { hashPassword } from "better-auth/crypto";
import { prisma } from "@/lib/prisma";

/** Create email/password user without public signup (admin/invite only). */
export async function createCredentialUser(input: {
  email: string;
  password: string;
  name: string;
}) {
  const email = input.email.trim().toLowerCase();
  const hashed = await hashPassword(input.password);

  return prisma.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        email,
        name: input.name.trim(),
        emailVerified: false,
      },
    });

    await tx.account.create({
      data: {
        userId: user.id,
        accountId: user.id,
        providerId: "credential",
        password: hashed,
      },
    });

    return user;
  });
}

export async function setCredentialPassword(userId: string, password: string) {
  const hashed = await hashPassword(password);
  const account = await prisma.account.findFirst({
    where: { userId, providerId: "credential" },
  });
  if (account) {
    await prisma.account.update({
      where: { id: account.id },
      data: { password: hashed },
    });
  } else {
    await prisma.account.create({
      data: {
        userId,
        accountId: userId,
        providerId: "credential",
        password: hashed,
      },
    });
  }
}
