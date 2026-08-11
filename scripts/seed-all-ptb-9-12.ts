/**
 * Master PTB seeder: Class 9 + 10 + 11 + 12.
 * Safe to re-run (importers upsert / skip existing keys).
 *
 * Usage: npx tsx scripts/seed-all-ptb-9-12.ts
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";

type Step = { name: string; args: string[] };

const STEPS: Step[] = [
  // Class 9 — all subjects in seed folders
  { name: "Class 9 (all subjects)", args: ["scripts/import-lahore-class9.ts"] },

  // Class 10 — dedicated subject importers first
  { name: "Class 10 Biology", args: ["scripts/import-lahore-biology.ts", "10th"] },
  { name: "Class 10 Computer", args: ["scripts/import-lahore-computer.ts", "10th"] },
  { name: "Class 10 Chemistry", args: ["scripts/import-lahore-chemistry.ts", "10th"] },
  { name: "Class 10 Physics", args: ["scripts/import-lahore-physics.ts", "10th"] },
  { name: "Class 10 English", args: ["scripts/import-lahore-english.ts", "10th"] },
  { name: "Class 10 Mathematics", args: ["scripts/import-lahore-mathematics.ts", "10th"] },
  {
    name: "Class 10 Pakistan Studies",
    args: ["scripts/import-lahore-pakstudies.ts", "10th"],
  },
  // Class 10 remaining subjects (civics, urdu, etc.)
  { name: "Class 10 remaining subjects", args: ["scripts/import-lahore-remaining-10.ts"] },

  // Class 11 / 12
  { name: "Class 11 (Inter-I) all subjects", args: ["scripts/import-lahore-inter1.ts"] },
  { name: "Class 12 (Inter-II) all subjects", args: ["scripts/import-lahore-inter2.ts"] },

  // Final coverage check
  { name: "Audit PTB coverage", args: ["scripts/audit-ptb-coverage.ts"] },
  { name: "Check PTB class counts", args: ["scripts/check-ptb-classes.ts"] },
];

function runStep(step: Step): Promise<number> {
  return new Promise((resolve) => {
    console.log(`\n========== START: ${step.name} ==========`);
    const child = spawn(
      process.execPath,
      [path.join("node_modules", "tsx", "dist", "cli.mjs"), ...step.args],
      {
        cwd: process.cwd(),
        stdio: "inherit",
        env: process.env,
        shell: false,
      },
    );
    child.on("exit", (code, signal) => {
      const exitCode = code ?? (signal ? 1 : 0);
      console.log(
        `========== END: ${step.name} (exit ${exitCode}) ==========`,
      );
      resolve(exitCode);
    });
  });
}

async function main() {
  const started = Date.now();
  const results: Array<{ name: string; code: number }> = [];

  for (const step of STEPS) {
    const code = await runStep(step);
    results.push({ name: step.name, code });
    if (code !== 0) {
      console.error(`\nFAILED at: ${step.name} (exit ${code})`);
      console.error("Stopping so nothing is silently missed.");
      process.exit(code);
    }
  }

  console.log("\n========== MASTER SEED SUMMARY ==========");
  for (const r of results) {
    console.log(`${r.code === 0 ? "OK" : "FAIL"}  ${r.name}`);
  }
  console.log(
    `Done in ${Math.round((Date.now() - started) / 1000)}s — all Class 9-12 steps finished.`,
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
