// Exit 0 skips the build; exit 1 continues it.
// Preview PRs were posting a red GitHub check when Vercel canceled them.
//
// If system env vars are not exposed, VERCEL_ENV is undefined and the old
// "production only" check would skip EVERY build (including production).
const env = process.env.VERCEL_ENV ?? "";
const ref = process.env.VERCEL_GIT_COMMIT_REF ?? "";

if (!env && !ref) {
  // Safer default: never freeze production when envs are missing.
  console.log("vercel-ignore: no VERCEL_ENV/REF — continuing build");
  process.exit(1);
}

const isProd =
  env === "production" || ref === "master" || ref === "main";

console.log(
  `vercel-ignore: VERCEL_ENV=${env || "(empty)"} REF=${ref || "(empty)"} → ${
    isProd ? "build" : "skip"
  }`,
);
process.exit(isProd ? 1 : 0);
