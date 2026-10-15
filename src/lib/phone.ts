import { UserError } from "@/lib/safe-action";
// Indian mobile numbers: 10 digits, first digit 6-9. Stored without the
// country code; +91 is added when sending on WhatsApp.

export const PHONE_ERROR =
  "Enter a valid 10-digit Indian mobile number (starting with 6, 7, 8 or 9)";

// Accepts what people actually type ("+91 98765 43210", "098765-43210") and
// returns the bare 10 digits, or null when it is not an Indian mobile.
export function normalizeIndianMobile(
  input: string | number | bigint | null | undefined
): string | null {
  let digits = String(input ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

// Same, for server actions: throws with a message fit to show the user.
export function requireIndianMobile(
  input: string | number | bigint | null | undefined
): bigint {
  const digits = normalizeIndianMobile(input);
  if (!digits) throw new UserError(PHONE_ERROR);
  return BigInt(digits);
}
