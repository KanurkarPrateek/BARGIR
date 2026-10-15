import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { CommissionView } from "@/components/commission-view";
import { PageTitle } from "@/components/ui";

export default async function MyCommission() {
  const user = await requireUser();
  if (user.role === "admin") redirect("/team");
  return (
    <>
      <PageTitle title="My commission" description={`You earn ${user.commissionPercent}% on every payment from gyms you sell (unless agreed otherwise for a gym).`} />
      <CommissionView userId={user.id} />
    </>
  );
}
