// Exit 0 skips the build; exit 1 continues it.
// Preview PRs were posting a red GitHub check when Vercel canceled them.
process.exit(process.env.VERCEL_ENV === "production" ? 1 : 0);
