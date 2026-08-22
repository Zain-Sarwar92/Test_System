/**
 * Smoke checks for session + API soft lock + sealed JSON.
 *
 * Usage (dev server running):
 *   npx tsx scripts/smoke-api-security.ts
 */
import "dotenv/config";

const base =
  process.env.SMOKE_BASE_URL ??
  process.env.NEXT_PUBLIC_APP_URL ??
  process.env.APP_URL ??
  "http://localhost:5001";

async function main() {
  const root = base.replace(/\/+$/, "");
  console.log("Base:", root);

  // 1) No cookie → session-check must fail
  const anon = await fetch(`${root}/api/org-admin/session-check`, {
    headers: { Accept: "application/json" },
  });
  console.log(
    "anon session-check:",
    anon.status,
    anon.status === 401 || anon.status === 403 ? "OK" : "UNEXPECTED",
  );

  // 2) Cron without secret → 401
  const cronNoSecret = await fetch(`${root}/api/cron/test-reminders`);
  console.log(
    "cron no secret:",
    cronNoSecret.status,
    cronNoSecret.status === 401 || cronNoSecret.status === 503
      ? "OK"
      : "UNEXPECTED",
  );

  // 3) Envelope unit check (server helpers)
  const { sealPayloadForBrowser, openPayloadServer } = await import(
    "../src/lib/api-envelope"
  );
  const sealed = sealPayloadForBrowser({ hello: "world", n: 1 });
  const opened = openPayloadServer<{ hello: string; n: number }>(sealed);
  console.log(
    "envelope round-trip:",
    opened.hello === "world" && opened.n === 1 ? "OK" : "FAIL",
    sealed.v,
    Boolean(sealed.ct && sealed.iv && sealed.k),
  );

  console.log("\nManual UI check: login as org-admin, open Network tab,");
  console.log("GET /api/org-admin/session-check → body should be {v,iv,ct,k}.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
