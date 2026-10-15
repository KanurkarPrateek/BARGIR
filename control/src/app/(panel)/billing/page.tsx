import Link from "next/link";
import { endOfMonth, format, startOfMonth, subMonths } from "date-fns";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessNumbers } from "@/lib/queries";
import { day, monthlyValue, renewalState, rupees } from "@/lib/business";
import { Badge, Card, PageTitle, Stat } from "@/components/ui";

export default async function Billing() {
  await requireAdmin();
  const gyms = await db.gymAccount.findMany({ include: { salesperson: true }, orderBy: { renewalDate: "asc" } });
  const n = businessNumbers(gyms);
  const since = startOfMonth(subMonths(new Date(), 11));
  const payments = await db.payment.findMany({ where: { date: { gte: since } }, include: { gym: true }, orderBy: { date: "desc" } });
  const months = Array.from({ length: 12 }, (_, i) => {
    const start = startOfMonth(subMonths(new Date(), 11 - i)), end = endOfMonth(start);
    const inMonth = payments.filter((p) => p.date >= start && p.date <= end);
    return { label: format(start, "MMM yy"), amount: inMonth.reduce((s, p) => s + p.amount, 0), commission: inMonth.reduce((s, p) => s + p.commission, 0) };
  });
  const max = Math.max(1, ...months.map((m) => m.amount));
  const upcoming = gyms.filter((g) => g.status === "active" || g.status === "trial").slice(0, 30);

  return (
    <>
      <PageTitle title="Billing" description="What gyms pay you." />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={rupees(n.mrr)} hint={`yearly run-rate ${rupees(n.mrr * 12)}`} />
        <Stat label="Collected this month" value={rupees(months[11].amount)} />
        <Stat label="Overdue" value={String(n.overdue.length)} hint={rupees(n.overdue.reduce((s, g) => s + g.price, 0))} />
        <Stat label="Due in 7 days" value={String(n.dueSoon.length)} hint={rupees(n.dueSoon.reduce((s, g) => s + g.price, 0))} />
      </div>

      <Card title="Collected per month" description="Last 12 months. Hover a bar for the amount.">
        <div className="flex h-40 items-end gap-2 border-b border-stone-200 dark:border-stone-800">
          {months.map((m) => (
            <div key={m.label} className="flex h-full flex-1 items-end justify-center" title={`${m.label}: ${rupees(m.amount)} collected, ${rupees(m.commission)} commission`}>
              <div className="w-3/5 max-w-8 rounded-t bg-blue-600 dark:bg-blue-500" style={{ height: `${(m.amount / max) * 100}%`, minHeight: m.amount ? 2 : 0 }} />
            </div>
          ))}
        </div>
        <div className="mt-1 flex gap-2 text-[10px] text-stone-500">{months.map((m) => <span key={m.label} className="flex-1 text-center">{m.label}</span>)}</div>
      </Card>

      <Card title="Upcoming renewals">
        {upcoming.length === 0 ? <p className="text-sm text-stone-500">No active gyms.</p> : (
          <table>
            <thead><tr><th>Gym</th><th>Renewal</th><th>Status</th><th className="text-right">Amount</th><th className="text-right">Per month</th></tr></thead>
            <tbody>
              {upcoming.map((g) => {
                const s = renewalState(g);
                return (
                  <tr key={g.id}>
                    <td><Link href={`/gyms/${g.id}`} className="font-medium hover:underline">{g.name}</Link><br /><span className="text-stone-500">{g.ownerPhone}</span></td>
                    <td>{day(g.renewalDate)}</td><td><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className="text-right tabular-nums">{rupees(g.price)}</td><td className="text-right tabular-nums">{rupees(monthlyValue(g))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recent payments">
        {payments.length === 0 ? <p className="text-sm text-stone-500">No payments in the last 12 months.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Gym</th><th>Mode</th><th className="text-right">Amount</th><th className="text-right">Commission</th></tr></thead>
            <tbody>
              {payments.slice(0, 50).map((p) => (
                <tr key={p.id}><td>{day(p.date)}</td><td><Link href={`/gyms/${p.gym_id}`} className="hover:underline">{p.gym.name}</Link></td><td className="uppercase">{p.mode}</td>
                  <td className="text-right tabular-nums">{rupees(p.amount)}</td><td className="text-right tabular-nums">{p.commission ? rupees(p.commission) : "—"}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>
    </>
  );
}
