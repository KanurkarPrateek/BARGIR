"use server";

// Expense Management: money going out, and profit = collections - expenses.
import prisma, { requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import { PaymentMode, parseDate, todayString } from "@/lib/membership";
import { endOfDay, format, isValid, startOfDay, startOfMonth, subMonths } from "date-fns";


export interface ExpenseInput {
  category: string;
  amount: number;
  date?: string;
  mode: PaymentMode;
  note?: string;
}

export interface ExpenseRow {
  id: string;
  category: string;
  amount: number;
  date: string;
  mode: PaymentMode;
  note: string | null;
}

export async function AddExpense(data: ExpenseInput): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    const amount = Math.trunc(data.amount);
    if (!data.category.trim()) throw new UserError("Choose what the expense was for");
    if (!(amount > 0)) throw new UserError("Enter the amount spent");
    const date = data.date || todayString();
    if (!isValid(parseDate(date))) throw new UserError("Invalid date");
    await prisma.expense.create({
      data: { category: data.category.trim(), amount, date, mode: data.mode, note: data.note?.trim() || null },
    });
  });
}

export async function DeleteExpense(id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await prisma.expense.delete({ where: { id } });
  });
}

const inRange = (date: string, from: Date, to: Date) => {
  const d = parseDate(date);
  return d >= from && d <= to;
};

export async function GetExpenses(from: string, to: string): Promise<{ rows: ExpenseRow[]; total: number; byCategory: Record<string, number> } | Failed> {
  return safe(async () => {
    await requireOwner();
    const start = startOfDay(parseDate(from)), end = endOfDay(parseDate(to));
    const rows = (await prisma.expense.findMany({ orderBy: { createdAt: "desc" } }))
      .filter((e) => inRange(e.date, start, end))
      .sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
    const byCategory: Record<string, number> = {};
    for (const e of rows) byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
    return {
      rows: rows.map(({ id, category, amount, date, mode, note }) => ({ id, category, amount, date, mode, note })),
      total: rows.reduce((sum, e) => sum + e.amount, 0),
      byCategory,
    };
  });
}

export interface ProfitMonth {
  month: string; // "Oct 2026"
  collected: number;
  spent: number;
  profit: number;
}

// The last six months, newest first.
export async function GetProfitByMonth(): Promise<ProfitMonth[] | Failed> {
  return safe(async () => {
    await requireOwner();
    const [payments, expenses] = await Promise.all([
      prisma.payment.findMany({ select: { amount: true, date: true } }),
      prisma.expense.findMany({ select: { amount: true, date: true } }),
    ]);
    const months: ProfitMonth[] = [];
    for (let back = 0; back < 6; back++) {
      const start = startOfMonth(subMonths(new Date(), back));
      const suffix = format(start, "-MM-yyyy");
      const collected = payments.filter((p) => p.date.endsWith(suffix)).reduce((s, p) => s + p.amount, 0);
      const spent = expenses.filter((e) => e.date.endsWith(suffix)).reduce((s, e) => s + e.amount, 0);
      months.push({ month: format(start, "MMM yyyy"), collected, spent, profit: collected - spent });
    }
    return months;
  });
}
