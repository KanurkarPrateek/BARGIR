"use server";

// Sales Analytics: what sold, what was collected, which packages and
// channels perform, and how many members renew. Owner only.
import prisma, { requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import { membershipStatus, parseDate, saleDue } from "@/lib/membership";
import { endOfDay, format, isValid, startOfDay, startOfMonth, subMonths } from "date-fns";

export interface PackageRow {
  name: string;
  sold: number;
  value: number; // after discount
  discount: number;
  share: number; // of period sales value, 0-100
  activeNow: number; // members whose current plan is this package
}

export interface SaleExportRow {
  date: string;
  member: string;
  phone: string;
  package: string;
  price: number;
  discount: number;
  net: number;
  paid: number;
  due: number;
  trainer: string;
  type: "New" | "Renewal";
}

export interface SalesAnalytics {
  from: string;
  to: string;
  salesValue: number;
  collected: number;
  subscriptions: number;
  newMembers: number;
  renewals: number;
  averageSale: number;
  discounts: number;
  outstanding: number;
  // Memberships that ended in the period and how many of them renewed.
  ended: number;
  renewed: number;
  months: { month: string; sold: number; collected: number }[];
  packages: PackageRow[];
  modes: { mode: string; amount: number }[];
  trainers: { name: string; sold: number; value: number }[];
  enquiries: { total: number; joined: number; lost: number; open: number; bySource: { source: string; total: number; joined: number }[] };
  rows: SaleExportRow[];
}

const inRange = (date: string, start: Date, end: Date) => {
  const d = parseDate(date);
  return d >= start && d <= end;
};

export async function GetSalesAnalytics(from: string, to: string): Promise<SalesAnalytics | Failed> {
  return safe(async () => {
    await requireOwner();
    const start = startOfDay(parseDate(from)), end = endOfDay(parseDate(to));
    if (!isValid(start) || !isValid(end) || start > end) throw new UserError("Pick a valid date range");

    const [sales, payments, members, enquiries] = await Promise.all([
      prisma.sales.findMany({
        include: {
          service: { select: { name: true } },
          member: { select: { id: true, name: true, phone: true } },
          trainer: { select: { name: true } },
        },
      }),
      prisma.payment.findMany({ select: { amount: true, date: true, mode: true } }),
      prisma.member.findMany({ select: { id: true, sales: { select: { endDate: true, service: { select: { name: true } } } } } }),
      prisma.enquiry.findMany({ select: { type: true, status: true, createdAt: true } }),
    ]);

    // A member's first subscription is "new"; every later one is a renewal.
    const firstSale = new Map<string, { id: string; start: number }>();
    for (const s of sales) {
      const t = parseDate(s.startDate).getTime();
      const cur = firstSale.get(s.member_id);
      if (!cur || t < cur.start) firstSale.set(s.member_id, { id: s.id, start: t });
    }

    const inPeriod = sales.filter((s) => inRange(s.startDate, start, end));
    const net = (s: { amount: number; discount: number }) => s.amount - s.discount;
    const salesValue = inPeriod.reduce((sum, s) => sum + net(s), 0);
    const newCount = inPeriod.filter((s) => firstSale.get(s.member_id)?.id === s.id).length;

    // Renewal rate: memberships that ended within the period (and before
    // today), counted as renewed when the member bought anything later.
    const today = startOfDay(new Date());
    const endedSales = sales.filter((s) => {
      const e = parseDate(s.endDate);
      return e >= start && e <= end && e < today;
    });
    const renewed = endedSales.filter((s) =>
      sales.some((o) => o.member_id === s.member_id && o.id !== s.id && parseDate(o.startDate) > parseDate(s.startDate))
    ).length;

    // Packages: period sales plus how many members are on each package now.
    const byPackage = new Map<string, PackageRow>();
    for (const s of inPeriod) {
      const row = byPackage.get(s.service.name) ?? { name: s.service.name, sold: 0, value: 0, discount: 0, share: 0, activeNow: 0 };
      row.sold++; row.value += net(s); row.discount += s.discount;
      byPackage.set(s.service.name, row);
    }
    for (const m of members) {
      const status = membershipStatus(m.sales);
      if (status.state !== "active" && status.state !== "expiring") continue;
      const current = m.sales.find((s) => s.endDate === status.endDate);
      if (!current) continue;
      const row = byPackage.get(current.service.name) ?? { name: current.service.name, sold: 0, value: 0, discount: 0, share: 0, activeNow: 0 };
      row.activeNow++;
      byPackage.set(current.service.name, row);
    }
    const packages = [...byPackage.values()]
      .map((r) => ({ ...r, share: salesValue ? Math.round((r.value / salesValue) * 1000) / 10 : 0 }))
      .sort((a, b) => b.value - a.value || b.activeNow - a.activeNow);

    const periodPayments = payments.filter((p) => inRange(p.date, start, end));
    const modes = new Map<string, number>();
    for (const p of periodPayments) modes.set(p.mode, (modes.get(p.mode) ?? 0) + p.amount);

    const trainers = new Map<string, { name: string; sold: number; value: number }>();
    for (const s of inPeriod) {
      if (!s.trainer) continue;
      const row = trainers.get(s.trainer.name) ?? { name: s.trainer.name, sold: 0, value: 0 };
      row.sold++; row.value += net(s);
      trainers.set(s.trainer.name, row);
    }

    const months = [];
    for (let back = 11; back >= 0; back--) {
      const m = startOfMonth(subMonths(new Date(), back));
      const suffix = format(m, "-MM-yyyy");
      months.push({
        month: format(m, "MMM yy"),
        sold: sales.filter((s) => s.startDate.endsWith(suffix)).reduce((sum, s) => sum + net(s), 0),
        collected: payments.filter((p) => p.date.endsWith(suffix)).reduce((sum, p) => sum + p.amount, 0),
      });
    }

    const periodEnquiries = enquiries.filter((e) => e.createdAt >= start && e.createdAt <= end);
    const sources = new Map<string, { source: string; total: number; joined: number }>();
    for (const e of periodEnquiries) {
      const row = sources.get(e.type) ?? { source: e.type, total: 0, joined: 0 };
      row.total++; if (e.status === "joined") row.joined++;
      sources.set(e.type, row);
    }

    return {
      from, to,
      salesValue,
      collected: periodPayments.reduce((sum, p) => sum + p.amount, 0),
      subscriptions: inPeriod.length,
      newMembers: newCount,
      renewals: inPeriod.length - newCount,
      averageSale: inPeriod.length ? Math.round(salesValue / inPeriod.length) : 0,
      discounts: inPeriod.reduce((sum, s) => sum + s.discount, 0),
      outstanding: sales.reduce((sum, s) => sum + saleDue(s), 0),
      ended: endedSales.length,
      renewed,
      months,
      packages,
      modes: [...modes.entries()].map(([mode, amount]) => ({ mode, amount })).sort((a, b) => b.amount - a.amount),
      trainers: [...trainers.values()].sort((a, b) => b.value - a.value),
      enquiries: {
        total: periodEnquiries.length,
        joined: periodEnquiries.filter((e) => e.status === "joined").length,
        lost: periodEnquiries.filter((e) => e.status === "lost").length,
        open: periodEnquiries.filter((e) => e.status === "open" || e.status === "trial").length,
        bySource: [...sources.values()].sort((a, b) => b.total - a.total),
      },
      rows: inPeriod
        .sort((a, b) => parseDate(a.startDate).getTime() - parseDate(b.startDate).getTime())
        .map((s) => ({
          date: s.startDate,
          member: s.member.name,
          phone: s.member.phone.toString(),
          package: s.service.name,
          price: s.amount,
          discount: s.discount,
          net: net(s),
          paid: s.paid,
          due: saleDue(s),
          trainer: s.trainer?.name ?? "",
          type: firstSale.get(s.member_id)?.id === s.id ? "New" as const : "Renewal" as const,
        })),
    };
  });
}
