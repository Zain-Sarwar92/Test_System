<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## Auth / API security

- Sessions: Better Auth **httpOnly cookies** only. Do **not** store JWTs or session tokens in `localStorage` / `sessionStorage`.
- Browser `/api/org-admin/*` routes: use `requireBrowserApiSession` (session + same-origin / trusted Origin).
- Cron: `/api/cron/*` uses `Authorization: Bearer CRON_SECRET` (not browser Origin).
- JSON obfuscation: `sealedJson` / `fetchSealedJson` — Network-tab obfuscation only, not a Postman ban.