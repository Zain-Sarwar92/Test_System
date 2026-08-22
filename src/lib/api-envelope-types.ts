/** Shared envelope shape (safe for client + server imports). */
export const API_ENVELOPE_VERSION = 1 as const;

export type SealedEnvelope = {
  v: typeof API_ENVELOPE_VERSION;
  iv: string;
  ct: string;
  k?: string;
};
