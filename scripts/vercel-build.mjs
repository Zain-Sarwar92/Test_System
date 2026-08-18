import { spawnSync } from "node:child_process";

function run(command) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: process.env,
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

const vercelEnv = process.env.VERCEL_ENV ?? "development";
console.log([vercel-build] environment= + vercelEnv);

if (vercelEnv === "production") {
  run("prisma migrate deploy");
}

run("npm run build");

console.log("[vercel-build] environment=" + vercelEnv);
