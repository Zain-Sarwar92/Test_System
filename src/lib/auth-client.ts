"use client";

import { createAuthClient } from "better-auth/react";

// Same-origin requests — avoid wrong host/port from env mismatch
export const authClient = createAuthClient();
