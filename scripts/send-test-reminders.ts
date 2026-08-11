import "dotenv/config";
import { runTestScheduleReminders } from "../src/lib/test-schedule-reminders";

async function main() {
  const result = await runTestScheduleReminders();
  console.log(
    JSON.stringify(
      {
        ok: true,
        ...result,
      },
      null,
      2,
    ),
  );
  if (result.failed > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
