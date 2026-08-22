"use client";

import type { SealedEnvelope } from "@/lib/api-envelope-types";

function b64urlToBytes(value: string): Uint8Array<ArrayBuffer> {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function hexToBytes(hex: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Decode a sealed /api JSON envelope in the browser (Web Crypto). */
export async function openBrowserEnvelope<T = unknown>(
  envelope: SealedEnvelope,
): Promise<T> {
  if (envelope.v !== 1) {
    throw new Error("Unsupported envelope version");
  }
  if (!envelope.k) {
    throw new Error("Missing envelope key");
  }

  const key = await crypto.subtle.importKey(
    "raw",
    hexToBytes(envelope.k),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );

  const iv = b64urlToBytes(envelope.iv);
  const blob = b64urlToBytes(envelope.ct);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    blob,
  );

  return JSON.parse(new TextDecoder().decode(plain)) as T;
}

export async function fetchSealedJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<T> {
  const response = await fetch(input, {
    ...init,
    credentials: init?.credentials ?? "same-origin",
    headers: {
      Accept: "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const body = (await response.json()) as SealedEnvelope | { error?: string };
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && body.error
        ? String(body.error)
        : `Request failed (${response.status})`;
    throw new Error(message);
  }

  if (
    body &&
    typeof body === "object" &&
    "v" in body &&
    "ct" in body &&
    "iv" in body
  ) {
    return openBrowserEnvelope<T>(body as SealedEnvelope);
  }

  return body as T;
}
