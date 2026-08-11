/**
 * Legacy backfill helper (already applied). Kept for documentation.
 * Subjects now live under TestScheduleRound only.
 */
import "dotenv/config";
import { prisma } from "../src/lib/prisma";

async function main() {
  const schedules = await prisma.testSchedule.findMany({
    select: {
      id: true,
      rounds: {
        select: {
          id: true,
          subjects: { select: { id: true } },
        },
      },
    },
  });

  let createdRounds = 0;
  for (const schedule of schedules) {
    if (schedule.rounds.length > 0) continue;
    await prisma.testScheduleRound.create({
      data: {
        scheduleId: schedule.id,
        name: "Round 1",
        order: 0,
      },
    });
    createdRounds += 1;
  }

  console.log(
    `Checked ${schedules.length} schedule(s). Created ${createdRounds} empty Round 1 placeholder(s).`,
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
