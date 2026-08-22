import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import {
  API_ENVELOPE_VERSION,
  type SealedEnvelope,
} from "@/lib/api-envelope-types";

export type { SealedEnvelope };
export { API_ENVELOPE_VERSION };

/**
 * Obfuscation envelope for JSON /api responses (NOT strong end-to-end crypto).
 * Network tab shows sealed blobs instead of plain JSON fields.
 */

function masterSecret(): string {
  return (
    process.env.API_ENVELOPE_SECRET ??
    process.env.BETTER_AUTH_SECRET ??
    "dev-only-envelope-secret-change-me"
  );
}

/** Derive a 32-byte key for browser-visible envelopes (obfuscation-grade). */
export function publicEnvelopeKeyHex(): string {
  return createHash("sha256")
    .update(`gb-envelope-v1:${masterSecret()}`)
    .digest("hex");
}

function keyFromHex(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}

export function sealPayloadForBrowser(data: unknown): SealedEnvelope {
  const k = publicEnvelopeKeyHex();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFromHex(k), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const encrypted = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: API_ENVELOPE_VERSION,
    iv: iv.toString("base64url"),
    ct: Buffer.concat([encrypted, tag]).toString("base64url"),
    k,
  };
}

/** Server-side open (tests / internal). */
export function openPayloadServer<T = unknown>(envelope: SealedEnvelope): T {
  if (envelope.v !== API_ENVELOPE_VERSION) {
    throw new Error("Unsupported envelope version");
  }
  if (!envelope.k) {
    throw new Error("Missing envelope key");
  }
  const iv = Buffer.from(envelope.iv, "base64url");
  const blob = Buffer.from(envelope.ct, "base64url");
  const tag = blob.subarray(blob.length - 16);
  const data = blob.subarray(0, blob.length - 16);
  const decipher = createDecipheriv("aes-256-gcm", keyFromHex(envelope.k), iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(data), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8")) as T;
}

export function sealedJson(data: unknown, init?: { status?: number }) {
  return NextResponse.json(sealPayloadForBrowser(data), {
    status: init?.status ?? 200,
    headers: {
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
      "X-Api-Envelope": "1",
    },
  });
}
