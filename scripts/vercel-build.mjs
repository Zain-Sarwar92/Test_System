import { spawnSync } from "node:child_process";

function run(command, extraEnv = {}) {
  const result = spawnSync(command, {
    stdio: "inherit",
    shell: true,
    env: { ...process.env, ...extraEnv },
  });
  if ((result.status ?? 1) !== 0) {
    process.exit(result.status ?? 1);
  }
}

const vercelEnv = process.env.VERCEL_ENV ?? "development";

if (vercelEnv === "production") {
  // Neon pooled URLs hang on pg_advisory_lock during migrate.
  const directUrl =
    process.env.DATABASE_URL_UNPOOLED ||
    process.env.POSTGRES_URL_NON_POOLING ||
    process.env.DATABASE_URL;
  run("prisma migrate deploy", { DATABASE_URL: directUrl });
}

run("npm run build");
