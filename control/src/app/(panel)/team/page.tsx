import Link from "next/link";
import { requireAdmin } from "@/lib/auth";
import { db } from "@/lib/db";
import { newPassword } from "@/lib/crypto";
import { commissionSummary } from "@/lib/queries";
import { monthlyValue, rupees } from "@/lib/business";
import { addUser } from "../../actions";
import { Badge, btn, Card, Field, Notice, PageTitle } from "@/components/ui";

export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string; ok?: string }> }) {
  await requireAdmin();
  const notice = await searchParams;
  const users = await db.user.findMany({ orderBy: [{ active: "desc" }, { name: "asc" }], include: { gyms: true } });
  const sums = await Promise.all(users.map((u) => commissionSummary(u.id)));
  return (
    <>
      <PageTitle title="Sales team" description="Who sells the software, their commission, and what they are owed." />
      <Notice params={notice} />
      <Card>
        <table>
          <thead><tr><th>Name</th><th>Gyms sold</th><th className="text-right">Their MRR</th><th className="text-right">Commission %</th><th className="text-right">Earned this month</th><th className="text-right">Owed</th></tr></thead>
          <tbody>
            {users.map((u, i) => (
              <tr key={u.id} className={u.active ? "" : "opacity-50"}>
                <td><Link href={`/team/${u.id}`} className="font-medium hover:underline">{u.name}</Link> {u.role === "admin" && <Badge>Admin</Badge>} {!u.active && <Badge tone="red">Off</Badge>}<br /><span className="text-stone-500">{u.email}</span></td>
                <td className="tabular-nums">{u.gyms.length}</td>
                <td className="text-right tabular-nums">{rupees(u.gyms.filter((g) => g.status === "active").reduce((s, g) => s + monthlyValue(g), 0))}</td>
                <td className="text-right tabular-nums">{u.commissionPercent}%</td>
                <td className="text-right tabular-nums">{rupees(sums[i].thisMonth)}</td>
                <td className="text-right font-medium tabular-nums">{rupees(sums[i].owed)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card title="Add a salesperson" description="They sign in here with their email and see only the gyms they sold and their commission.">
        <form action={addUser} className="grid gap-4 sm:grid-cols-3">
          <Field label="Name"><input name="name" required /></Field>
          <Field label="Email"><input name="email" type="email" required /></Field>
          <Field label="Password" hint="Send it to them."><input name="password" required minLength={8} defaultValue={newPassword()} /></Field>
          <Field label="Commission %"><input name="commissionPercent" type="number" min={0} max={100} required defaultValue={10} /></Field>
          <Field label="Role"><select name="role" defaultValue="sales"><option value="sales">Sales</option><option value="admin">Admin (full access)</option></select></Field>
          <div className="flex items-end"><button className={btn}>Add</button></div>
        </form>
      </Card>
    </>
  );
}
