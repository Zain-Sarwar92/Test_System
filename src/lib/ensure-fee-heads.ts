import { Prisma } from "@/generated/prisma/client";
import { DEFAULT_FEE_HEAD_SEEDS } from "@/lib/fee-head-rules";
import { prisma } from "@/lib/prisma";

/** Ensure org has the standard fee heads used by the counter hub. */
export async function ensureDefaultFeeHeads(organizationId: string) {
  for (const seed of DEFAULT_FEE_HEAD_SEEDS) {
    const defaultAmount =
      "defaultAmount" in seed && seed.defaultAmount
        ? new Prisma.Decimal(seed.defaultAmount)
        : null;
    await prisma.feeHead.upsert({
      where: {
        organizationId_name: { organizationId, name: seed.name },
      },
      update:
        seed.frequency === "ONE_TIME"
          ? {
              frequency: "ONE_TIME",
              category: seed.category,
              isActive: true,
              ...(defaultAmount ? { defaultAmount } : {}),
            }
          : { isActive: true },
      create: {
        organizationId,
        name: seed.name,
        category: seed.category,
        frequency: seed.frequency,
        description: seed.description,
        defaultAmount,
        isActive: true,
      },
    });
  }
}
