import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { decrypt } from "@/lib/crypto";
import { clusterGyms, clusterStatus, type ClusterStatus, type RemoteGym } from "@/lib/cluster-api";
import { openSecrets, renderEnv, vercelEnv } from "@/lib/cluster-config";
import { day, renewalState } from "@/lib/business";
import { deleteCluster, updateCluster } from "../../../actions";
import { ClusterFields } from "@/components/cluster-form";
import { ConfirmButton, CopyButton } from "@/components/client";
import { Badge, btn, btnDanger, Card, Meter, Notice, PageTitle } from "@/components/ui";

export default async function ClusterPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireAdmin();
  const [{ id }, notice] = await Promise.all([params, searchParams]);
  const cluster = await db.cluster.findUnique({ where: { id }, include: { gyms: { orderBy: { name: "asc" } } } });
  if (!cluster) notFound();
  const secrets = openSecrets(cluster.secretsEncrypted);
  const platformKey = decrypt(cluster.apiKeyEncrypted);
  let status: ClusterStatus | undefined, remote: RemoteGym[] = [], error: string | undefined;
  try {
    [status, remote] = await Promise.all([clusterStatus(cluster), clusterGyms(cluster)]);
  } catch (e) {
    error = e instanceof Error ? e.message : "Unreachable";
  }
  const linked = new Set(cluster.gyms.map((g) => g.remoteId));
  const unlinked = remote.filter((r) => !linked.has(r.id));
  const vercel = secrets ? vercelEnv(secrets, platformKey, cluster.senderUrl) : "";
  const render = secrets ? renderEnv(secrets, cluster.appUrl) : "";

  return (
    <>
      <PageTitle title={cluster.name} description={<a href={cluster.appUrl} target="_blank" className="underline">{cluster.appUrl}</a>} actions={<Meter used={cluster.gyms.length} total={cluster.capacity} />} />
      <Notice params={notice} />

      <Card title="Health" description="Checked just now.">
        {error ? <p className="text-sm text-red-700 dark:text-red-400">{error}</p> : status && (
          <div className="flex flex-wrap gap-6 text-sm">
            <div><p className="text-stone-500">App</p><Badge tone="green">Up</Badge> <span className="text-stone-500">{status.responseMs} ms</span></div>
            <div><p className="text-stone-500">Database</p><Badge tone={status.database ? "green" : "red"}>{status.database ? "OK" : "Failing"}</Badge></div>
            <div><p className="text-stone-500">WhatsApp sender</p><Badge tone={status.sender === "ok" ? "green" : status.sender === "not configured" ? "gray" : "amber"}>{status.sender === "ok" ? "OK" : status.sender === "not configured" ? "Not set" : "Asleep or down"}</Badge></div>
            <div><p className="text-stone-500">Version</p><p className="font-mono">{status.version}</p></div>
            <div><p className="text-stone-500">Self sign-up</p><p>{status.signupOpen ? <span className="text-amber-700 dark:text-amber-400">Open (set ALLOW_SIGNUP=false)</span> : "Closed"}</p></div>
          </div>
        )}
      </Card>

      <Card title="Gyms on this cluster">
        {cluster.gyms.length === 0 && unlinked.length === 0 ? <p className="text-sm text-stone-500">None yet.</p> : (
          <table>
            <thead><tr><th>Gym</th><th>Members</th><th>WhatsApp</th><th>Status</th></tr></thead>
            <tbody>
              {cluster.gyms.map((g) => {
                const r = remote.find((x) => x.id === g.remoteId);
                const s = renewalState(g);
                return (
                  <tr key={g.id}>
                    <td><Link href={`/gyms/${g.id}`} className="font-medium hover:underline">{g.name}</Link></td>
                    <td className="tabular-nums">{r ? `${r.activeMembers} / ${r.members}` : "—"}</td>
                    <td>{r ? (r.whatsappLinked ? "Linked" : "Not linked") : "—"}</td>
                    <td><Badge tone={s.tone}>{s.label}</Badge></td>
                  </tr>
                );
              })}
              {unlinked.map((r) => (
                <tr key={r.id} className="bg-amber-50 dark:bg-amber-950/30">
                  <td>{r.name}<br /><span className="text-xs text-stone-500">Not in the Control Panel · created {day(r.createdAt)} · owner {r.ownerName} {r.ownerPhone}</span></td>
                  <td className="tabular-nums">{r.activeMembers} / {r.members}</td>
                  <td>{r.whatsappLinked ? "Linked" : "Not linked"}</td>
                  <td><Link className="text-sm underline" href={`/gyms/new?${new URLSearchParams({ remoteId: r.id, cluster_id: cluster.id, name: r.name, ownerName: r.ownerName ?? "", ownerPhone: r.ownerPhone ?? "", status: "trial" })}`}>Link</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Set up or check this cluster" description="Paste these into each service. Vercel and Render both accept the whole block pasted into the first Key box.">
        {!secrets ? <p className="text-sm text-red-700">Settings cannot be read (CONTROL_SECRET changed?).</p> : (
          <ol className="list-decimal space-y-5 pl-5 text-sm">
            <li>
              <p className="mb-2"><b>Vercel</b> → project → Settings → Environment Variables. Then redeploy.</p>
              <details><summary className="cursor-pointer text-stone-500">Show values</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs dark:bg-stone-800">{vercel}</pre>
              </details>
              <div className="mt-2"><CopyButton text={vercel} label="Copy Vercel settings" /></div>
            </li>
            <li>
              <p className="mb-2"><b>Render</b> → New → Blueprint → this repository (it reads <code>render.yaml</code>), with these values. Then put its address in <i>WhatsApp sender address</i> below and redeploy Vercel.</p>
              <details><summary className="cursor-pointer text-stone-500">Show values</summary>
                <pre className="mt-2 overflow-x-auto rounded-md bg-stone-100 p-3 text-xs dark:bg-stone-800">{render}</pre>
              </details>
              <div className="mt-2"><CopyButton text={render} label="Copy Render settings" /></div>
            </li>
            <li>Reload this page: <b>Health</b> should show App, Database and Sender OK.</li>
            <li>Gym-app admin login (for emergencies): <code>{cluster.appUrl}/signin</code> with <code>{secrets.superadminLogin}</code> / <span className="inline-flex gap-2"><code>••••••</code><CopyButton text={secrets.superadminPassword} label="Copy password" /></span></li>
          </ol>
        )}
      </Card>

      <form action={updateCluster} className="space-y-6">
        <input type="hidden" name="id" value={cluster.id} />
        <ClusterFields cluster={cluster} secrets={secrets} />
        <button className={btn}>Save changes</button>
      </form>

      <Card title="Remove">
        <form action={deleteCluster} className="flex items-center gap-3">
          <input type="hidden" name="id" value={cluster.id} />
          <ConfirmButton message="Remove this cluster from the Control Panel? The deployment itself is not touched." className={btnDanger}>Remove cluster</ConfirmButton>
          <p className="text-sm text-stone-500">Only possible when no gyms are linked to it.</p>
        </form>
      </Card>
    </>
  );
}
