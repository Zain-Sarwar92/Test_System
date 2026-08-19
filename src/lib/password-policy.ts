import { z } from "zod";

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 72;
export const PASSWORD_HINT =
  "At least 10 characters, with a letter and a number";

export function passwordMeetsPolicy(password: string): boolean {
  if (password.length < PASSWORD_MIN_LENGTH || password.length > PASSWORD_MAX_LENGTH) {
    return false;
  }
  return /[A-Za-z]/.test(password) && /\d/.test(password);
}

export const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Password must be at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(PASSWORD_MAX_LENGTH, `Password must be ${PASSWORD_MAX_LENGTH} characters or fewer.`)
  .refine(
    (value) => /[A-Za-z]/.test(value) && /\d/.test(value),
    "Password must include at least one letter and one number.",
  );
