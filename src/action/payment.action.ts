"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import prisma, { requireOwner } from "@/lib/tenant";
import { PaymentMode, parseDate, saleDue, todayString } from "@/lib/membership";
import { runSaleWorkflows } from "@/lib/whatsapp/workflows";
import { endOfDay, isValid, startOfDay } from "date-fns";

export interface PaymentInput {
  sale_id: string;
  amount: number;
  mode: PaymentMode;
  date?: string; // dd-MM-yyyy, defaults to today
  note?: string;
}

export interface PaymentResponse {
  id: string;
  sale_id: string;
  member_id: string;
  member_name: string;
  service_name: string;
  amount: number;
  mode: PaymentMode;
  date: string;
  note: string | null;
}

// Records money received against a sale and keeps the sale's paid total in step.
export async function RecordPayment(data: PaymentInput): Promise<void | Failed> {
  return safe(async () => {
    const amount = Math.trunc(data.amount);
    if (!(amount > 0)) throw new UserError("Enter the amount received");
    const date = data.date || todayString();
    if (!isValid(parseDate(date))) throw new UserError("Invalid payment date");

    const sale = await prisma.sales.findUnique({ where: { id: data.sale_id } });
    if (!sale) throw new UserError("Sale not found");
    if (amount > saleDue(sale)) {
      throw new UserError(`Only ₹${saleDue(sale)} is due on this sale`);
    }

    const payment = await prisma.$transaction(async (tx) => {
      // The due check is repeated inside the update, so two people collecting
      // the same balance at once cannot both succeed.
      const updated = await tx.$executeRaw`
        UPDATE "Sales" SET paid = paid + ${amount}
        WHERE id = ${sale.id} AND amount - discount - paid >= ${amount}`;
      if (updated === 0) throw new UserError("This payment was already collected");
      return tx.payment.create({
        data: {
          sale_id: sale.id,
          member_id: sale.member_id,
          amount,
          mode: data.mode,
          date,
          note: data.note?.trim() || null,
        },
      });
    });

    // The receipt is a courtesy; the payment is already saved either way.
    // A payment entered with an earlier date is an old record: no receipt.
    if (date === todayString()) await runSaleWorkflows("payment_received", sale.id, { paidNow: amount, key: payment.id }).catch(
      (error) => console.error("Failed to queue payment receipt:", error)
    );
  });
}

// Removes a payment entered by mistake.
export async function DeletePayment(id: string): Promise<void> {
  await requireOwner();
  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) return;
  await prisma.$transaction([
    prisma.payment.delete({ where: { id } }),
    prisma.sales.update({
      where: { id: payment.sale_id },
      data: { paid: { decrement: payment.amount } },
    }),
  ]);
}

// Payments received between two dates (inclusive, dd-MM-yyyy), newest first,
// with totals overall and per payment mode.
export async function GetPayments(from: string, to: string): Promise<{
  payments: PaymentResponse[];
  total: number;
  byMode: Record<string, number>;
}> {
  await requireOwner();
  const start = startOfDay(parseDate(from));
  const end = endOfDay(parseDate(to));
  if (!isValid(start) || !isValid(end)) throw new UserError("Invalid date range");

  // Dates are stored as text, so the range is applied here rather than in SQL.
  const all = await prisma.payment.findMany({
    include: {
      member: { select: { name: true } },
      sale: { select: { service: { select: { name: true } } } },
    },
    orderBy: { createdAt: "desc" },
  });
  const payments = all.filter((payment) => {
    const date = parseDate(payment.date);
    return date >= start && date <= end;
  });

  const byMode: Record<string, number> = {};
  for (const payment of payments) {
    byMode[payment.mode] = (byMode[payment.mode] ?? 0) + payment.amount;
  }

  return {
    payments: payments.map((payment) => ({
      id: payment.id,
      sale_id: payment.sale_id,
      member_id: payment.member_id,
      member_name: payment.member.name,
      service_name: payment.sale.service.name,
      amount: payment.amount,
      mode: payment.mode,
      date: payment.date,
      note: payment.note,
    })),
    total: payments.reduce((sum, payment) => sum + payment.amount, 0),
    byMode,
  };
}
