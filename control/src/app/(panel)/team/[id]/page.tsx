import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { commissionSummary } from "@/lib/queries";
import { inputDate, renewalState } from "@/lib/business";
import { deletePayout, recordPayout, updateUser } from "../../../actions";
import { CommissionView } from "@/components/commission-view";
import { ConfirmButton } from "@/components/client";
import { Badge, btn, Card, Field, Notice, PageTitle } from "@/components/ui";

export default async function Member({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireAdmin();
  const [{ id }, notice] = await Promise.all([params, searchParams]);
  const user = await db.user.findUnique({ where: { id }, include: { gyms: { orderBy: { name: "asc" } } } });
  if (!user) notFound();
  const { owed } = await commissionSummary(id);
  return (
    <>
      <PageTitle title={user.name} description={`${user.email} · ${user.role === "admin" ? "Admin" : "Sales"} · ${user.commissionPercent}% commission`} />
      <Notice params={notice} />
      <CommissionView userId={id} payoutActions={(payoutId) => (
        <form action={deletePayout}><input type="hidden" name="id" value={payoutId} /><ConfirmButton message="Delete this payout?" className="text-xs text-red-600 underline">Delete</ConfirmButton></form>
      )} />
      <div className="grid gap-6 lg:grid-cols-2">
        <Card title="Pay commission">
          <form action={recordPayout} className="space-y-4">
            <input type="hidden" name="user_id" value={id} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Amount (₹)"><input name="amount" type="number" min={1} required defaultValue={owed > 0 ? owed : undefined} /></Field>
              <Field label="Date"><input name="date" type="date" required defaultValue={inputDate(new Date())} /></Field>
            </div>
            <Field label="Note"><input name="note" placeholder="e.g. UPI ref" /></Field>
            <button className={btn}>Record payout</button>
          </form>
        </Card>
        <Card title="Gyms sold">
          {user.gyms.length === 0 ? <p className="text-sm text-stone-500">None yet.</p> : (
            <ul className="space-y-2 text-sm">{user.gyms.map((g) => { const s = renewalState(g); return <li key={g.id} className="flex justify-between gap-2"><Link href={`/gyms/${g.id}`} className="hover:underline">{g.name}</Link><span>{g.commissionPercent}% · <Badge tone={s.tone}>{s.label}</Badge></span></li>; })}</ul>
          )}
        </Card>
      </div>
      <Card title="Login and commission">
        <form action={updateUser} className="grid gap-4 sm:grid-cols-3">
          <input type="hidden" name="id" value={id} />
          <Field label="Name"><input name="name" required defaultValue={user.name} /></Field>
          <Field label="Commission % (new sales)"><input name="commissionPercent" type="number" min={0} max={100} required defaultValue={user.commissionPercent} /></Field>
          <Field label="Role"><select name="role" defaultValue={user.role}><option value="sales">Sales</option><option value="admin">Admin</option></select></Field>
          <Field label="New password" hint="Leave empty to keep."><input name="password" minLength={8} autoComplete="new-password" /></Field>
          <label className="flex items-center gap-2 self-end pb-2 font-normal"><input type="checkbox" name="active" defaultChecked={user.active} /> Can sign in</label>
          <div className="flex items-end"><button className={btn}>Save</button></div>
        </form>
      </Card>
    </>
  );
}
