import type { InvoiceDelivery } from "@/action/sales.action"

// One line for a toast, saying where the invoice went.
export function describeDelivery(delivery: InvoiceDelivery | undefined): string {
  if (!delivery) return ""
  if (delivery.email.status === "skipped" && delivery.email.reason === "backdated") {
    return "Old record: no invoice sent."
  }
  const parts: string[] = []
  if (delivery.whatsapp > 0) parts.push("WhatsApp")
  if (delivery.email.status === "sent") parts.push(`email (${delivery.email.to})`)
  const sent = parts.length ? `Invoice sent on ${parts.join(" and ")}.` : "Invoice not sent."
  const problem =
    delivery.email.status === "failed" ? ` Email failed: ${delivery.email.error}` : ""
  return sent + problem
}
