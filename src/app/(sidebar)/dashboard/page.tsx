import { SectionCards } from "@/components/section-cards"
import { SetupBanner } from "@/components/onboarding/setup-banner"
import PendingPayments from "../sales/pending-payments/PendingPayments"

export default function Page() {
  return (
    <>
      <SetupBanner />
      <SectionCards />
      <div className="px-4 lg:px-6">
        <PendingPayments />
      </div>
    </>
  )
}
