import { NextRequest, NextResponse } from "next/server";
import { runTestScheduleReminders } from "@/lib/test-schedule-reminders";

function authorize(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return { ok: false as const, status: 503, error: "CRON_SECRET is not configured" };
  }

  const header = request.headers.get("authorization");
  const bearer =
    header?.startsWith("Bearer ") ? header.slice("Bearer ".length).trim() : null;

  if (bearer === secret) {
    return { ok: true as const };
  }

  return { ok: false as const, status: 401, error: "Unauthorized" };
}

async function handle(request: NextRequest) {
  const auth = authorize(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const result = await runTestScheduleReminders();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(request: NextRequest) {
  return handle(request);
}

export async function POST(request: NextRequest) {
  return handle(request);
}
