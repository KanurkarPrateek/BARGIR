import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { gymScope, liveClusters } from "@/lib/queries";
import { day, planLabel, renewalState, rupees } from "@/lib/business";
import { Badge, btn, Card, Notice, PageTitle } from "@/components/ui";

const FILTERS = [["all", "All"], ["active", "Active"], ["trial", "Trial"], ["due", "Due / overdue"], ["suspended", "Suspended"], ["cancelled", "Cancelled"]] as const;

export default async function Gyms({ searchParams }: { searchParams: Promise<{ show?: string; q?: string; error?: string; ok?: string }> }) {
  const params = await searchParams;
  const user = await requireUser();
  const admin = user.role === "admin";
  const show = params.show ?? "all";
  const q = (params.q ?? "").trim();
  let gyms = await db.gymAccount.findMany({
    where: {
      ...gymScope(user),
      ...(["active", "trial", "suspended", "cancelled"].includes(show) ? { status: show as any } : {}),
      ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" } }, { ownerName: { contains: q, mode: "insensitive" } }, { ownerPhone: { contains: q } }, { city: { contains: q, mode: "insensitive" } }] } : {}),
    },
    include: { cluster: true, salesperson: true },
    orderBy: { name: "asc" },
  });
  if (show === "due") gyms = gyms.filter((g) => ["red", "amber"].includes(renewalState(g).tone) && g.status !== "suspended");
  const live = admin ? await liveClusters([...new Map(gyms.map((g) => [g.cluster.id, g.cluster])).values()]) : new Map();

  return (
    <>
      <PageTitle title={admin ? "Gyms" : "My gyms"} description={`${gyms.length} shown`} actions={admin && <Link href="/gyms/new" className={btn}>+ New gym</Link>} />
      <Notice params={params} />
      <form className="flex flex-wrap items-center gap-2">
        {FILTERS.map(([value, label]) => (
          <Link key={value} href={`/gyms?show=${value}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
            className={`rounded-full border px-3 py-1 text-sm ${show === value ? "border-stone-900 bg-stone-900 text-white dark:border-stone-100 dark:bg-stone-100 dark:text-stone-900" : "border-stone-300 dark:border-stone-700"}`}>{label}</Link>
        ))}
        <input type="hidden" name="show" value={show} />
        <input name="q" defaultValue={q} placeholder="Search name, owner, phone, city" className="ml-auto max-w-64" />
      </form>
      <Card>
        {gyms.length === 0 ? <p className="text-sm text-stone-500">No gyms here.</p> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Gym</th><th>Plan</th><th>Renewal</th>{admin && <th>Sold by</th>}{admin && <th>Cluster</th>}{admin && <th>Usage</th>}</tr></thead>
              <tbody>
                {gyms.map((g) => {
                  const s = renewalState(g);
                  const remote = live.get(g.cluster_id)?.gyms?.find((r: any) => r.id === g.remoteId);
                  return (
                    <tr key={g.id}>
                      <td><Link href={`/gyms/${g.id}`} className="font-medium hover:underline">{g.name}</Link><br /><span className="text-stone-500">{g.ownerName} · {g.ownerPhone}{g.city ? ` · ${g.city}` : ""}</span></td>
                      <td>{planLabel(g.plan)}<br /><span className="text-stone-500 tabular-nums">{rupees(g.price)}</span></td>
                      <td>{day(g.renewalDate)}<br /><Badge tone={s.tone}>{s.label}</Badge></td>
                      {admin && <td>{g.salesperson?.name ?? <span className="text-stone-400">—</span>}{g.salesperson && <><br /><span className="text-stone-500">{g.commissionPercent}%</span></>}</td>}
                      {admin && <td>{g.cluster.name}</td>}
                      {admin && <td className="text-stone-500">{remote ? <>{remote.activeMembers} active members<br />{remote.whatsappLinked ? "WhatsApp linked" : "WhatsApp not linked"}</> : live.get(g.cluster_id)?.error ? "cluster unreachable" : "—"}</td>}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
