import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveClusters } from "@/lib/queries";
import { newPassword } from "@/lib/crypto";
import { inputDate, PLANS } from "@/lib/business";
import { createGym } from "../../../actions";
import { btn, Card, Field, Notice, PageTitle } from "@/components/ui";

type Params = Record<string, string | undefined>;

export default async function NewGym({ searchParams }: { searchParams: Promise<Params> }) {
  await requireAdmin();
  const p = await searchParams;
  const [clusters, team] = await Promise.all([
    db.cluster.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { gyms: true } } } }),
    db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }),
  ]);
  // Only clusters that answer right now can take a gym; fill the emptiest first.
  const live = await liveClusters(clusters);
  const problem = (c: (typeof clusters)[number]) => (live.get(c.id)?.error ? "not reachable" : c._count.gyms >= c.capacity ? "full" : null);
  const open = clusters.filter((c) => !problem(c)).sort((a, b) => (a._count.gyms / a.capacity) - (b._count.gyms / b.capacity));
  const linking = !!p.remoteId;
  const clusterId = p.cluster_id ?? open[0]?.id;

  if (clusters.length === 0) {
    return <Card title="Add a cluster first"><p className="text-sm">Gyms live on a cluster. <Link href="/clusters/new" className="underline">Add your first cluster</Link>.</p></Card>;
  }
  return (
    <>
      <PageTitle title={linking ? "Link an existing gym" : "New gym"} description={linking ? "This gym already exists on its cluster (for example it signed itself up). Add its business details." : "Creates the gym and its owner login on the chosen cluster."} />
      <Notice params={p} />
      <form action={createGym} className="space-y-6">
        {linking && <input type="hidden" name="remoteId" value={p.remoteId} />}
        <Card title="Gym and owner">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Gym name"><input name="name" required defaultValue={p.name} /></Field>
            <Field label="City"><input name="city" defaultValue={p.city} /></Field>
            <Field label="Owner name"><input name="ownerName" required defaultValue={p.ownerName} /></Field>
            <Field label="Owner mobile" hint="The owner signs in with this number."><input name="ownerPhone" required inputMode="tel" defaultValue={p.ownerPhone} readOnly={linking} /></Field>
            {!linking && <Field label="Owner password" hint="Copy it now and send it to the owner. They can change it later."><input name="password" required minLength={8} defaultValue={newPassword()} /></Field>}
            <Field label="Cluster">
              <select name="cluster_id" defaultValue={clusterId} required disabled={linking}>
                {clusters.map((c) => <option key={c.id} value={c.id} disabled={!linking && !!problem(c)}>{c.name} — {c._count.gyms}/{c.capacity} gyms{problem(c) ? ` (${problem(c)})` : ""}</option>)}
              </select>
              {linking && <input type="hidden" name="cluster_id" value={clusterId} />}
              {!linking && open.length === 0 && <p className="text-xs text-red-700 dark:text-red-400">No cluster can take a gym right now (all full or not reachable). <Link href="/clusters" className="underline">Check clusters</Link>.</p>}
            </Field>
          </div>
        </Card>
        <Card title="Subscription">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Plan"><select name="plan" defaultValue={p.plan ?? "monthly"}>{PLANS.map((pl) => <option key={pl.value} value={pl.value}>{pl.label}</option>)}</select></Field>
            <Field label="Price per plan (₹)"><input name="price" type="number" min={0} required defaultValue={p.price ?? "999"} /></Field>
            <Field label="Start date"><input name="startDate" type="date" required defaultValue={p.startDate ?? inputDate(new Date())} /></Field>
            <Field label="Status"><select name="status" defaultValue={p.status ?? "active"}><option value="active">Paid</option><option value="trial">Free trial</option></select></Field>
            <Field label="Trial days" hint="Only for a free trial."><input name="trialDays" type="number" min={1} defaultValue={p.trialDays ?? "14"} /></Field>
          </div>
        </Card>
        <Card title="Sale" description="Commission is paid on every payment this gym makes.">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Sold by">
              <select name="salesperson_id" defaultValue={p.salesperson_id ?? ""}>
                <option value="">Nobody (direct)</option>
                {team.map((u) => <option key={u.id} value={u.id}>{u.name} ({u.commissionPercent}%)</option>)}
              </select>
            </Field>
            <Field label="Commission %" hint="Leave empty to use the salesperson's usual %."><input name="commissionPercent" type="number" min={0} max={100} defaultValue={p.commissionPercent} /></Field>
            <Field label="Notes"><input name="notes" defaultValue={p.notes} /></Field>
          </div>
        </Card>
        <button className={btn}>{linking ? "Link gym" : "Create gym"}</button>
      </form>
    </>
  );
}
