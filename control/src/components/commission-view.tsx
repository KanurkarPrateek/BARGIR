import Link from "next/link";
import { db } from "@/lib/db";
import { commissionSummary } from "@/lib/queries";
import { day, rupees } from "@/lib/business";
import { Card, Stat } from "./ui";

// One salesperson's commission: earned per payment, paid out, still owed.
export async function CommissionView({ userId, payoutActions }: { userId: string; payoutActions?: (payoutId: string) => React.ReactNode }) {
  const [sum, payments, payouts, gyms] = await Promise.all([
    commissionSummary(userId),
    db.payment.findMany({ where: { salesperson_id: userId, commission: { gt: 0 } }, include: { gym: true }, orderBy: { date: "desc" }, take: 100 }),
    db.payout.findMany({ where: { user_id: userId }, orderBy: { date: "desc" } }),
    db.gymAccount.count({ where: { salesperson_id: userId } }),
  ]);
  return (
    <>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Owed now" value={rupees(sum.owed)} />
        <Stat label="Earned this month" value={rupees(sum.thisMonth)} />
        <Stat label="Earned all time" value={rupees(sum.earned)} hint={`${gyms} gym${gyms === 1 ? "" : "s"} sold`} />
        <Stat label="Paid out" value={rupees(sum.paid)} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Commission earned" description="From each payment a gym you sold made.">
          {payments.length === 0 ? <p className="text-sm text-stone-500">Nothing yet.</p> : (
            <table>
              <thead><tr><th>Date</th><th>Gym</th><th className="text-right">Payment</th><th className="text-right">Commission</th></tr></thead>
              <tbody>{payments.map((p) => <tr key={p.id}><td>{day(p.date)}</td><td><Link href={`/gyms/${p.gym_id}`} className="hover:underline">{p.gym.name}</Link></td><td className="text-right tabular-nums">{rupees(p.amount)}</td><td className="text-right tabular-nums">{rupees(p.commission)}</td></tr>)}</tbody>
            </table>
          )}
        </Card>
        <Card title="Payouts">
          {payouts.length === 0 ? <p className="text-sm text-stone-500">No payouts yet.</p> : (
            <table>
              <thead><tr><th>Date</th><th>Note</th><th className="text-right">Amount</th>{payoutActions && <th></th>}</tr></thead>
              <tbody>{payouts.map((p) => <tr key={p.id}><td>{day(p.date)}</td><td className="text-stone-500">{p.note}</td><td className="text-right tabular-nums">{rupees(p.amount)}</td>{payoutActions && <td className="text-right">{payoutActions(p.id)}</td>}</tr>)}</tbody>
            </table>
          )}
        </Card>
      </div>
    </>
  );
}
