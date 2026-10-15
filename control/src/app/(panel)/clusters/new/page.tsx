import { requireAdmin } from "@/lib/auth";
import { generateSecrets } from "@/lib/cluster-config";
import { addCluster } from "../../../actions";
import { ClusterFields } from "@/components/cluster-form";
import { btn, Card, Notice, PageTitle } from "@/components/ui";

export default async function NewCluster({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  await requireAdmin();
  const notice = await searchParams;
  const { platformKey, ...secrets } = generateSecrets();
  return (
    <>
      <PageTitle title="New cluster" description="Fresh secrets are filled in for you. Save first, then the cluster page gives you everything to paste into Vercel and Render." />
      <Notice params={notice} />
      <Card title="Before you start">
        <ol className="list-decimal space-y-1 pl-5 text-sm">
          <li>Create free accounts (a new email each time works): Supabase, Vercel, Render.</li>
          <li>Supabase: new project (Mumbai). From <b>Connect</b> copy the transaction pooler and session pooler addresses into the two database boxes below.</li>
          <li>Vercel: import the GitHub repository; note the app address it gives you.</li>
          <li>Save here, then follow the steps on the cluster page.</li>
        </ol>
      </Card>
      <form action={addCluster} className="space-y-6">
        <ClusterFields secrets={secrets} platformKey={platformKey} />
        <button className={btn}>Save cluster</button>
      </form>
    </>
  );
}
