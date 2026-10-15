import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { liveClusters } from "@/lib/queries";
import { Badge, btn, Card, Meter, Notice, PageTitle } from "@/components/ui";

export default async function Clusters({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireAdmin();
  const notice = await searchParams;
  const clusters = await db.cluster.findMany({ orderBy: { name: "asc" }, include: { _count: { select: { gyms: true } } } });
  const live = await liveClusters(clusters);
  return (
    <>
      <PageTitle title="Clusters" description="Each cluster is one Vercel app + one Supabase database + one Render WhatsApp sender." actions={<Link href="/clusters/new" className={btn}>+ New cluster</Link>} />
      <Notice params={notice} />
      <Card>
        {clusters.length === 0 ? <p className="text-sm text-stone-500">No clusters yet.</p> : (
          <div className="overflow-x-auto">
            <table>
              <thead><tr><th>Cluster</th><th>Gyms</th><th>Health</th><th>Accounts</th></tr></thead>
              <tbody>
                {clusters.map((c) => {
                  const l = live.get(c.id)!;
                  const unlinked = l.gyms ? l.gyms.length - c._count.gyms : 0;
                  return (
                    <tr key={c.id}>
                      <td><Link href={`/clusters/${c.id}`} className="font-medium hover:underline">{c.name}</Link><br /><span className="text-stone-500">{c.appUrl.replace(/^https?:\/\//, "")}</span></td>
                      <td><Meter used={c._count.gyms} total={c.capacity} />{unlinked > 0 && <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">{unlinked} not linked yet</p>}</td>
                      <td>
                        {l.error ? <Badge tone="red">Down</Badge> : (
                          <div className="flex flex-wrap gap-1">
                            <Badge tone={l.status!.database ? "green" : "red"}>Database</Badge>
                            <Badge tone={l.status!.sender === "ok" ? "green" : l.status!.sender === "not configured" ? "gray" : "amber"}>Sender</Badge>
                            <span className="text-xs text-stone-500">{l.status!.responseMs} ms · {l.status!.version}</span>
                          </div>
                        )}
                        {l.error && <p className="mt-1 text-xs text-stone-500">{l.error}</p>}
                      </td>
                      <td className="text-stone-500">{[c.vercelAccount, c.supabaseAccount, c.renderAccount].filter(Boolean).join(" · ") || "—"}</td>
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
