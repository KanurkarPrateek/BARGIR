import { Badge } from "@/components/ui/badge"
import { MembershipStatus } from "@/lib/membership"

export function membershipLabel(membership: MembershipStatus): string {
  if (membership.state === "none") return "No plan"
  if (membership.state === "expired") return `Expired ${membership.endDate}`
  return `Active till ${membership.endDate}`
}

const VARIANTS = {
  active: "default",
  expiring: "secondary",
  expired: "destructive",
  none: "outline",
} as const

const SHORT = {
  active: "Active",
  expiring: "Expiring soon",
  expired: "Expired",
  none: "No plan",
}

export function MembershipBadge({ membership }: { membership: MembershipStatus }) {
  return <Badge variant={VARIANTS[membership.state]}>{SHORT[membership.state]}</Badge>
}
