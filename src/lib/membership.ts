import { differenceInCalendarDays, format, parse, startOfDay } from "date-fns";

export const DATE_FORMAT = "dd-MM-yyyy";

export const todayString = () => format(new Date(), DATE_FORMAT);
export const parseDate = (date: string) => parse(date, DATE_FORMAT, new Date());

export type MembershipState = "active" | "expiring" | "expired" | "none";

export interface MembershipStatus {
  state: MembershipState;
  // Last day the member is covered, across all their sales.
  endDate: string | null;
  // Negative once expired.
  daysLeft: number | null;
}

// A paying member who has not come for this long is "dormant".
export const DORMANT_AFTER_DAYS = 7;

// Memberships ending within this many days are flagged for renewal.
export const EXPIRING_WITHIN_DAYS = 7;

export function membershipStatus(sales: { endDate: string }[]): MembershipStatus {
  if (sales.length === 0) return { state: "none", endDate: null, daysLeft: null };

  const latest = sales
    .map((sale) => parseDate(sale.endDate))
    .reduce((a, b) => (a > b ? a : b));
  const daysLeft = differenceInCalendarDays(latest, startOfDay(new Date()));
  const state =
    daysLeft < 0 ? "expired" : daysLeft <= EXPIRING_WITHIN_DAYS ? "expiring" : "active";
  return { state, endDate: format(latest, DATE_FORMAT), daysLeft };
}

export const saleDue = (sale: { amount: number; discount: number; paid: number }) =>
  sale.amount - sale.discount - sale.paid;

export const PAYMENT_MODES = [
  { value: "cash", label: "Cash" },
  { value: "upi", label: "UPI" },
  { value: "card", label: "Card" },
  { value: "bank_transfer", label: "Bank transfer" },
  { value: "other", label: "Other" },
] as const;

export type PaymentMode = (typeof PAYMENT_MODES)[number]["value"];

export const paymentModeLabel = (mode: string) =>
  PAYMENT_MODES.find((m) => m.value === mode)?.label ?? mode;

export const ENQUIRY_STATUSES = [
  { value: "open", label: "Open" },
  { value: "trial", label: "Trial" },
  { value: "joined", label: "Joined" },
  { value: "lost", label: "Lost" },
] as const;

export type EnquiryStatus = (typeof ENQUIRY_STATUSES)[number]["value"];

export const rupees = (amount: number) => `₹${amount.toLocaleString("en-IN")}`;
