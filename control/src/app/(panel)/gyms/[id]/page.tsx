import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPassword } from "@/lib/crypto";
import { clusterGyms, type RemoteGym } from "@/lib/cluster-api";
import { day, inputDate, nextRenewal, planLabel, PLANS, renewalState, rupees } from "@/lib/business";
import { deleteGymRecord, deletePayment, recordPayment, resetOwnerPassword, setGymStatus, updateGym } from "../../../actions";
import { Badge, btn, btnDanger, btnOutline, Card, Field, Notice, PageTitle, Stat } from "@/components/ui";
import { ConfirmButton } from "@/components/client";

export default async function GymPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  const [{ id }, notice, user] = await Promise.all([params, searchParams, requireUser()]);
  const admin = user.role === "admin";
  const gym = await db.gymAccount.findUnique({ where: { id }, include: { cluster: true, salesperson: true, payments: { orderBy: { date: "desc" }, include: { salesperson: true } } } });
  if (!gym || (!admin && gym.salesperson_id !== user.id)) notFound();
  const team = admin ? await db.user.findMany({ where: { active: true }, orderBy: { name: "asc" } }) : [];
  let remote: RemoteGym | undefined, remoteError: string | undefined;
  try {
    remote = gym.remoteId ? (await clusterGyms(gym.cluster)).find((g) => g.id === gym.remoteId) : undefined;
    if (gym.remoteId && !remote) remoteError = "This gym is no longer on its cluster";
  } catch (e) {
    remoteError = e instanceof Error ? e.message : "Cluster unreachable";
  }
  const s = renewalState(gym);
  const paid = gym.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageTitle title={gym.name} description={<>{gym.ownerName} · {gym.ownerPhone}{gym.city ? ` · ${gym.city}` : ""}{admin && <> · on <Link href={`/clusters/${gym.cluster_id}`} className="underline">{gym.cluster.name}</Link></>}</>}
        actions={<Badge tone={s.tone}>{s.label}</Badge>} />
      <Notice params={notice} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Stat label="Plan" value={rupees(gym.price)} hint={`${planLabel(gym.plan)} · since ${day(gym.startDate)}`} />
        <Stat label="Next renewal" value={day(gym.renewalDate)} hint={s.label} />
        <Stat label="Paid to date" value={rupees(paid)} hint={`${gym.payments.length} payment${gym.payments.length === 1 ? "" : "s"}`} />
        <Stat label="Sold by" value={gym.salesperson?.name ?? "Direct"} hint={gym.salesperson ? `${gym.commissionPercent}% commission` : undefined} />
      </div>

      <Card title="Live from the cluster" description="Read from the gym's own deployment just now.">
        {remote ? (
          <div className="grid grid-cols-2 gap-4 text-sm md:grid-cols-4">
            <div><p className="text-stone-500">Members</p><p className="font-medium">{remote.activeMembers} active of {remote.members}</p></div>
            <div><p className="text-stone-500">Last activity</p><p className="font-medium">{remote.lastActivity ? day(remote.lastActivity) : "None yet"}</p></div>
            <div><p className="text-stone-500">WhatsApp</p><p className="font-medium">{remote.whatsappLinked ? "Linked" : "Not linked"}</p></div>
            <div><p className="text-stone-500">Setup</p><p className="font-medium">{remote.setupDone ? "Finished" : "Not finished"} · {remote.machines} machine{remote.machines === 1 ? "" : "s"}</p></div>
            <div><p className="text-stone-500">Sign-in</p><p className="font-medium">{remote.active ? "Allowed" : "Switched off"}</p></div>
            <div><p className="text-stone-500">App address</p><p className="font-medium"><a href={`${gym.cluster.appUrl}/signin`} target="_blank" className="underline">{gym.cluster.appUrl.replace(/^https?:\/\//, "")}</a></p></div>
          </div>
        ) : <p className="text-sm text-amber-700 dark:text-amber-400">{remoteError ?? "Not linked to a gym on the cluster."}</p>}
      </Card>

      {admin && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Record a payment" description="Commission for the salesperson is worked out automatically.">
            <form action={recordPayment} className="space-y-4">
              <input type="hidden" name="gym_id" value={gym.id} />
              <div className="grid gap-4 sm:grid-cols-3">
                <Field label="Amount (₹)"><input name="amount" type="number" min={1} required defaultValue={gym.price} /></Field>
                <Field label="Date"><input name="date" type="date" required defaultValue={inputDate(new Date())} /></Field>
                <Field label="Mode"><select name="mode" defaultValue="upi"><option value="upi">UPI</option><option value="bank">Bank transfer</option><option value="cash">Cash</option><option value="card">Card</option></select></Field>
              </div>
              <Field label="Note"><input name="note" placeholder="e.g. UTR number" /></Field>
              <label className="flex items-center gap-2 font-normal"><input type="checkbox" name="extend" defaultChecked /> Renews the plan: next renewal becomes {day(nextRenewal(gym.renewalDate, gym.plan))}</label>
              <button className={btn}>Record payment</button>
            </form>
          </Card>
          <Card title="Account">
            <div className="space-y-5">
              <div className="flex flex-wrap gap-2">
                {(gym.status === "active" || gym.status === "trial") && (
                  <form action={setGymStatus}><input type="hidden" name="id" value={gym.id} /><input type="hidden" name="status" value="suspended" />
                    <ConfirmButton message={`Suspend ${gym.name}? Nobody at the gym can sign in until you resume it. Their data is kept.`} className={btnDanger}>Suspend</ConfirmButton></form>
                )}
                {(gym.status === "suspended" || gym.status === "cancelled") && (
                  <form action={setGymStatus}><input type="hidden" name="id" value={gym.id} /><input type="hidden" name="status" value="active" /><button className={btn}>Resume</button></form>
                )}
                {gym.status === "trial" && (
                  <form action={setGymStatus}><input type="hidden" name="id" value={gym.id} /><input type="hidden" name="status" value="active" /><button className={btnOutline}>Mark as paying</button></form>
                )}
                {gym.status !== "cancelled" && (
                  <form action={setGymStatus}><input type="hidden" name="id" value={gym.id} /><input type="hidden" name="status" value="cancelled" />
                    <ConfirmButton message={`Cancel ${gym.name}? Sign-in is switched off. Their data stays on the cluster.`} className={btnDanger}>Cancel subscription</ConfirmButton></form>
                )}
                {gym.status === "cancelled" && (
                  <form action={deleteGymRecord}><input type="hidden" name="id" value={gym.id} />
                    <ConfirmButton message="Remove this gym from the Control Panel? Its payments here are deleted too. The gym's data on the cluster is kept." className={btnDanger}>Remove from Control Panel</ConfirmButton></form>
                )}
              </div>
              <form action={resetOwnerPassword} className="flex flex-wrap items-end gap-2">
                <input type="hidden" name="id" value={gym.id} />
                <div className="min-w-48 flex-1"><Field label="New owner password"><input name="password" minLength={8} required defaultValue={newPassword()} /></Field></div>
                <ConfirmButton message="Change the owner's password? Tell them the new one." className={btnOutline}>Reset password</ConfirmButton>
              </form>
            </div>
          </Card>
        </div>
      )}

      <Card title="Payments">
        {gym.payments.length === 0 ? <p className="text-sm text-stone-500">No payments yet.</p> : (
          <table>
            <thead><tr><th>Date</th><th>Mode</th><th>Note</th><th className="text-right">Amount</th><th className="text-right">Commission</th>{admin && <th></th>}</tr></thead>
            <tbody>
              {gym.payments.map((p) => (
                <tr key={p.id}>
                  <td>{day(p.date)}</td><td className="uppercase">{p.mode}</td><td className="text-stone-500">{p.note}</td>
                  <td className="text-right tabular-nums">{rupees(p.amount)}</td>
                  <td className="text-right tabular-nums">{p.commission ? <>{rupees(p.commission)}<br /><span className="text-xs text-stone-500">{p.salesperson?.name}</span></> : "—"}</td>
                  {admin && <td className="text-right"><form action={deletePayment}><input type="hidden" name="id" value={p.id} /><ConfirmButton message="Delete this payment and its commission?" className="text-xs text-red-600 underline">Delete</ConfirmButton></form></td>}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      {admin && (
        <Card title="Details">
          <form action={updateGym} className="space-y-4">
            <input type="hidden" name="id" value={gym.id} />
            <div className="grid gap-4 sm:grid-cols-3">
              <Field label="Gym name"><input name="name" required defaultValue={gym.name} /></Field>
              <Field label="Owner name"><input name="ownerName" required defaultValue={gym.ownerName} /></Field>
              <Field label="Owner mobile" hint="Record only; the login itself is on the cluster."><input name="ownerPhone" required defaultValue={gym.ownerPhone} /></Field>
              <Field label="City"><input name="city" defaultValue={gym.city ?? ""} /></Field>
              <Field label="Plan"><select name="plan" defaultValue={gym.plan}>{PLANS.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}</select></Field>
              <Field label="Price per plan (₹)"><input name="price" type="number" min={0} required defaultValue={gym.price} /></Field>
              <Field label="Next renewal"><input name="renewalDate" type="date" required defaultValue={inputDate(gym.renewalDate)} /></Field>
              <Field label="Sold by">
                <select name="salesperson_id" defaultValue={gym.salesperson_id ?? ""}>
                  <option value="">Nobody (direct)</option>
                  {team.map((u) => <option key={u.id} value={u.id}>{u.name}</option>)}
                </select>
              </Field>
              <Field label="Commission %" hint="Applies to payments recorded from now on."><input name="commissionPercent" type="number" min={0} max={100} required defaultValue={gym.commissionPercent} /></Field>
            </div>
            <Field label="Notes"><textarea name="notes" rows={2} defaultValue={gym.notes ?? ""} /></Field>
            <button className={btn}>Save</button>
          </form>
        </Card>
      )}
    </>
  );
}
