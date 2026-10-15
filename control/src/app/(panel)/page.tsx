import Link from "next/link";
import { startOfMonth, subMonths, format } from "date-fns";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { businessNumbers, commissionSummary, gymScope } from "@/lib/queries";
import { day, renewalState, rupees } from "@/lib/business";
import { Badge, Card, Meter, PageTitle, Stat } from "@/components/ui";

export default async function Dashboard() {
  const user = await requireUser();
  const admin = user.role === "admin";
  const gyms = await db.gymAccount.findMany({ where: gymScope(user), include: { salesperson: true, cluster: true }, orderBy: { renewalDate: "asc" } });
  const n = businessNumbers(gyms);
  const monthStart = startOfMonth(new Date());
  const paymentScope = admin ? {} : { gym: { salesperson_id: user.id } };
  const [collected, lastMonth, commission, owedAll, clusters] = await Promise.all([
    db.payment.aggregate({ where: { ...paymentScope, date: { gte: monthStart } }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { ...paymentScope, date: { gte: subMonths(monthStart, 1), lt: monthStart } }, _sum: { amount: true } }),
    commissionSummary(user.id),
    admin ? Promise.all([db.payment.aggregate({ _sum: { commission: true } }), db.payout.aggregate({ _sum: { amount: true } })]) : null,
    admin ? db.cluster.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { gyms: true } } } }) : [],
  ]);
  const commissionOwed = owedAll ? (owedAll[0]._sum.commission ?? 0) - (owedAll[1]._sum.amount ?? 0) : 0;
  const attention = [...n.overdue, ...n.dueSoon];
  const totalCapacity = clusters.reduce((s, c) => s + c.capacity, 0);
  const used = clusters.reduce((s, c) => s + c._count.gyms, 0);

  return (
    <>
      <PageTitle title={admin ? "Business overview" : `Hello, ${user.name}`} description={format(new Date(), "EEEE, d MMMM yyyy")}
        actions={admin && <Link href="/gyms/new" className="rounded-md bg-stone-900 px-3 py-2 text-sm font-medium text-white dark:bg-stone-100 dark:text-stone-900">+ New gym</Link>} />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Monthly recurring revenue" value={rupees(n.mrr)} hint={`${n.active} paying gym${n.active === 1 ? "" : "s"}`} />
        <Stat label="Collected this month" value={rupees(collected._sum.amount ?? 0)} hint={`last month ${rupees(lastMonth._sum.amount ?? 0)}`} href={admin ? "/billing" : undefined} />
        <Stat label="Gyms" value={String(gyms.length)} hint={`${n.trial} on trial · ${n.suspended} suspended`} href="/gyms" />
        {admin
          ? <Stat label="Commission owed" value={rupees(commissionOwed)} hint="to the sales team" href="/team" />
          : <Stat label="My commission owed" value={rupees(commission.owed)} hint={`${rupees(commission.thisMonth)} earned this month`} href="/commission" />}
      </div>

      <Card title="Needs attention" description="Renewals overdue or due in the next 7 days.">
        {attention.length === 0 ? <p className="text-sm text-stone-500">Nothing due this week.</p> : (
          <table>
            <thead><tr><th>Gym</th><th>Owner</th><th>Renewal</th><th>Status</th><th className="text-right">Amount</th></tr></thead>
            <tbody>
              {attention.map((g) => {
                const s = renewalState(g);
                return (
                  <tr key={g.id}>
                    <td><Link href={`/gyms/${g.id}`} className="font-medium underline-offset-2 hover:underline">{g.name}</Link></td>
                    <td>{g.ownerName}<br /><span className="text-stone-500">{g.ownerPhone}</span></td>
                    <td>{day(g.renewalDate)}</td>
                    <td><Badge tone={s.tone}>{s.label}</Badge></td>
                    <td className="text-right tabular-nums">{rupees(g.price)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Card>

      {admin && (
        <Card title="Cluster capacity" description={`${used} of ${totalCapacity} gym slots used across ${clusters.length} cluster${clusters.length === 1 ? "" : "s"}.`}
          actions={<Link href="/clusters" className="text-sm underline">Manage clusters</Link>}>
          {clusters.length === 0 ? <p className="text-sm text-stone-500">No clusters yet. <Link href="/clusters/new" className="underline">Add the first one</Link>.</p> : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {clusters.map((c) => (
                <Link key={c.id} href={`/clusters/${c.id}`} className="rounded-md border border-stone-200 p-3 hover:bg-stone-50 dark:border-stone-800 dark:hover:bg-stone-800">
                  <p className="font-medium">{c.name}</p>
                  <p className="mb-2 truncate text-xs text-stone-500">{c.appUrl}</p>
                  <Meter used={c._count.gyms} total={c.capacity} />
                </Link>
              ))}
            </div>
          )}
          {clusters.length > 0 && used >= totalCapacity - 1 && <p className="mt-3 text-sm text-amber-700 dark:text-amber-400">Almost out of room: set up a new cluster before the next sale.</p>}
        </Card>
      )}
    </>
  );
}
