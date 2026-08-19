import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { toNextJsHandler } from "better-auth/next-js";
import {
  clientKeyFromRequest,
  consumeLoginAttempt,
  isAuthSignInRequest,
} from "@/lib/login-rate-limit";

const handler = toNextJsHandler(auth);

export const GET = handler.GET;

export async function POST(request: Request) {
  if (isAuthSignInRequest(request)) {
    const limited = consumeLoginAttempt(clientKeyFromRequest(request));
    if (!limited.ok) {
      return NextResponse.json(
        { message: "Too many sign-in attempts. Try again later." },
        {
          status: 429,
          headers: { "Retry-After": String(limited.retryAfterSec) },
        },
      );
    }
  }
  return handler.POST(request);
}
