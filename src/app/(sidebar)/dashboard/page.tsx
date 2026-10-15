import { SectionCards } from "@/components/section-cards"
import PendingPayments from "../sales/pending-payments/PendingPayments"

export default function Page() {
  return (
    <>
      <SectionCards />
      <div className="px-4 lg:px-6">
        <PendingPayments />
      </div>
    </>
  )
}
