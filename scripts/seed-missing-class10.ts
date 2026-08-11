/**
 * Import only Class 10 subjects that are commonly missing after partial runs:
 * Physics, English, Mathematics, Pakistan Studies.
 * Safe to re-run.
 */
import "dotenv/config";
import { spawn } from "node:child_process";
import path from "node:path";

const STEPS = [
  { name: "Class 10 Physics", args: ["scripts/import-lahore-physics.ts", "10th"] },
  { name: "Class 10 English", args: ["scripts/import-lahore-english.ts", "10th"] },
  { name: "Class 10 Mathematics", args: ["scripts/import-lahore-mathematics.ts", "10th"] },
  {
    name: "Class 10 Pakistan Studies",
    args: ["scripts/import-lahore-pakstudies.ts", "10th"],
  },
  { name: "Audit PTB coverage", args: ["scripts/audit-ptb-coverage.ts"] },
  { name: "List PTB subjects", args: ["scripts/list-ptb-subjects.ts"] },
  { name: "Check PTB class counts", args: ["scripts/check-ptb-classes.ts"] },
];

function runStep(name: string, args: string[]) {
  return new Promise<number>((resolve) => {
    console.log(`\n========== START: ${name} ==========`);
    const child = spawn(
      process.execPath,
      [path.join("node_modules", "tsx", "dist", "cli.mjs"), ...args],
      { cwd: process.cwd(), stdio: "inherit", env: process.env },
    );
    child.on("exit", (code, signal) => {
      const exitCode = code ?? (signal ? 1 : 0);
      console.log(`========== END: ${name} (exit ${exitCode}) ==========`);
      resolve(exitCode);
    });
  });
}

async function main() {
  for (const step of STEPS) {
    const code = await runStep(step.name, step.args);
    if (code !== 0) {
      console.error(`FAILED at ${step.name}`);
      process.exit(code);
    }
  }
  console.log("\nMissing Class 10 subjects import finished.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
