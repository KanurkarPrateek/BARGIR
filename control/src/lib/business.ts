// Plans, money and dates.
import { addMonths, differenceInCalendarDays, format, startOfDay } from "date-fns";
import type { Plan } from "@prisma/client";

export const PLANS: { value: Plan; label: string; months: number }[] = [
  { value: "monthly", label: "Monthly", months: 1 },
  { value: "quarterly", label: "Quarterly", months: 3 },
  { value: "half_yearly", label: "Half-yearly", months: 6 },
  { value: "yearly", label: "Yearly", months: 12 },
];
export const planMonths = (plan: Plan) => PLANS.find((p) => p.value === plan)!.months;
export const planLabel = (plan: Plan) => PLANS.find((p) => p.value === plan)!.label;
export const nextRenewal = (from: Date, plan: Plan) => addMonths(from, planMonths(plan));
// What a gym is worth per month, whatever its billing cycle.
export const monthlyValue = (gym: { price: number; plan: Plan }) => Math.round(gym.price / planMonths(gym.plan));

export const rupees = (n: number) => `₹${Math.round(n).toLocaleString("en-IN")}`;
export const day = (d: Date | string | null | undefined) => (d ? format(new Date(d), "dd MMM yyyy") : "—");
export const daysUntil = (d: Date) => differenceInCalendarDays(startOfDay(d), startOfDay(new Date()));
export const commissionOn = (amount: number, percent: number) => Math.round((amount * percent) / 100);

// "yyyy-MM-dd" from a date input, as local midnight.
export function parseInputDate(value: FormDataEntryValue | null): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value ?? ""));
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
}
export const inputDate = (d: Date) => format(d, "yyyy-MM-dd");

// 10-digit Indian mobile, from "+91 98…", "098…" and the like.
export function indianMobile(value: FormDataEntryValue | null): string | null {
  let digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 12 && digits.startsWith("91")) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith("0")) digits = digits.slice(1);
  return /^[6-9]\d{9}$/.test(digits) ? digits : null;
}

export function renewalState(gym: { status: string; renewalDate: Date }) {
  if (gym.status === "suspended") return { label: "Suspended", tone: "red" as const };
  if (gym.status === "cancelled") return { label: "Cancelled", tone: "gray" as const };
  const days = daysUntil(gym.renewalDate);
  if (days < 0) return { label: `Overdue ${-days} day${days === -1 ? "" : "s"}`, tone: "red" as const };
  if (days <= 7) return { label: days === 0 ? "Due today" : `Due in ${days} day${days === 1 ? "" : "s"}`, tone: "amber" as const };
  return { label: gym.status === "trial" ? "Trial" : "Active", tone: "green" as const };
}
