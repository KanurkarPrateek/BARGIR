import Link from "next/link";
import { notFound } from "next/navigation";
import { cookies } from "next/headers";
import { requireUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPassword as generatePassword } from "@/lib/crypto";
import { clusterGyms, gymLogins, type RemoteGym, type RemoteLogin } from "@/lib/cluster-api";
import { day, inputDate, nextRenewal, planLabel, PLANS, renewalState, rupees } from "@/lib/business";
import { addLogin, deleteGymRecord, deletePayment, recordPayment, removeLogin, setGymStatus, updateGym, updateLogin } from "../../../actions";
import { Badge, btn, btnDanger, btnOutline, Card, Field, Notice, PageTitle, Stat } from "@/components/ui";
import { ConfirmButton, CopyButton } from "@/components/client";

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
  const cookieStore = await cookies();
  const newPassword = admin ? cookieStore.get(`new_login_${gym.id}`)?.value : undefined;
  const loginNote = admin ? cookieStore.get(`login_note_${gym.id}`)?.value : undefined;
  let logins: RemoteLogin[] | undefined, loginsError: string | undefined;
  if (admin && remote) {
    try {
      logins = await gymLogins(gym.cluster, remote.id);
    } catch (e) {
      loginsError = e instanceof Error ? e.message : "Cluster unreachable";
    }
  }
  const s = renewalState(gym);
  const paid = gym.payments.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <PageTitle title={gym.name} description={<>{gym.ownerName} · {gym.ownerPhone}{gym.city ? ` · ${gym.city}` : ""}{admin && <> · on <Link href={`/clusters/${gym.cluster_id}`} className="underline">{gym.cluster.name}</Link></>}</>}
        actions={<Badge tone={s.tone}>{s.label}</Badge>} />
      <Notice params={notice} />
      {newPassword && (() => {
        const login = `${gym.name}\nSign in: ${gym.cluster.appUrl}/signin\nMobile: ${gym.ownerPhone}\nPassword: ${newPassword}`;
        return (
          <Card title="Owner login" description="Send this to the owner now. It is shown only for the next few minutes.">
            <pre className="mb-3 rounded-md bg-stone-100 p-3 text-sm dark:bg-stone-800">{login}</pre>
            <CopyButton text={login} label="Copy login details" />
          </Card>
        );
      })()}

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
            </div>
          </Card>
        </div>
      )}

      {admin && (
        <Card title="Logins" description="Who can sign in to this gym. Owner: everything. Reception: members, enquiries, attendance and sales, but no money reports, expenses, staff or settings. A changed password, role or removed login signs that person out within a minute.">
          {loginNote && (
            <div className="mb-4 rounded-md border border-emerald-300 bg-emerald-50 p-3 dark:border-emerald-800 dark:bg-emerald-950">
              <p className="mb-2 text-sm font-medium">Send this login now. It is shown only for the next few minutes.</p>
              <pre className="mb-3 rounded-md bg-white p-3 text-sm dark:bg-stone-900">{loginNote}</pre>
              <CopyButton text={loginNote} label="Copy login details" />
            </div>
          )}
          {!logins ? <p className="text-sm text-amber-700 dark:text-amber-400">{loginsError ?? remoteError ?? "Not linked to a gym on the cluster."}</p> : (
            <div className="space-y-5">
              <table>
                <thead><tr><th>Name</th><th>Mobile</th><th>Role</th><th></th></tr></thead>
                <tbody>
                  {logins.map((l) => (
                    <tr key={l.id}>
                      <td>{l.name}</td>
                      <td className="tabular-nums">{l.phone}</td>
                      <td><Badge tone={l.role === "owner" ? "green" : "blue"}>{l.role === "owner" ? "Owner" : "Reception"}</Badge></td>
                      <td className="text-right">
                        <details className="inline-block text-left">
                          <summary className="cursor-pointer text-sm underline">Change</summary>
                          <form action={updateLogin} className="mt-3 grid min-w-72 gap-3 rounded-md border p-3 sm:grid-cols-2">
                            <input type="hidden" name="id" value={gym.id} />
                            <input type="hidden" name="user_id" value={l.id} />
                            <Field label="Name"><input name="name" required defaultValue={l.name} /></Field>
                            <Field label="Mobile"><input name="phone" required defaultValue={l.phone} /></Field>
                            <Field label="Role"><select name="role" defaultValue={l.role}><option value="owner">Owner</option><option value="staff">Reception</option></select></Field>
                            <Field label="New password" hint="Leave empty to keep it"><input name="password" minLength={8} autoComplete="new-password" placeholder={`e.g. ${generatePassword()}`} /></Field>
                            <div className="flex flex-wrap gap-2 sm:col-span-2">
                              <button className={btn}>Save</button>
                            </div>
                          </form>
                          <form action={removeLogin} className="mt-2">
                            <input type="hidden" name="id" value={gym.id} />
                            <input type="hidden" name="user_id" value={l.id} />
                            <ConfirmButton message={`Remove ${l.name}'s login? They can no longer sign in. Their data stays.`} className="text-xs text-red-600 underline">Remove login</ConfirmButton>
                          </form>
                        </details>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <form action={addLogin} className="space-y-3 border-t pt-4">
                <input type="hidden" name="id" value={gym.id} />
                <p className="text-sm font-medium">Add a login</p>
                <div className="grid gap-3 sm:grid-cols-4">
                  <Field label="Name"><input name="name" required placeholder="e.g. Pooja Shinde" /></Field>
                  <Field label="Mobile"><input name="phone" required placeholder="10-digit number" /></Field>
                  <Field label="Role"><select name="role" defaultValue="staff"><option value="staff">Reception</option><option value="owner">Owner</option></select></Field>
                  <Field label="Password" hint="At least 8 characters"><input name="password" required minLength={8} autoComplete="new-password" defaultValue={generatePassword()} /></Field>
                </div>
                <button className={btnOutline}>Add login</button>
              </form>
            </div>
          )}
        </Card>
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
