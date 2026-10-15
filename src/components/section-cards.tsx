"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { DashboardSummary, GetDashboardSummary } from "@/action/dashboard.action"
import { rupees } from "@/lib/membership"
import { GetSessionInfo } from "@/action/staff.action"

type Person = DashboardSummary["expiring"][number]

function Stat({ label, value, hint, href }: { label: string; value: string | number; hint?: string; href: string }) {
  return (
    <Link href={href}>
      <Card className="@container/card hover:bg-muted/50 h-full">
        <CardHeader>
          <CardDescription>{label}</CardDescription>
          <CardTitle className="text-2xl font-semibold tabular-nums @[250px]/card:text-3xl">
            {value}
          </CardTitle>
          {hint && <CardDescription>{hint}</CardDescription>}
        </CardHeader>
      </Card>
    </Link>
  )
}

function PeopleCard({ title, empty, people, describe }: { title: string; empty: string; people: Person[]; describe: (person: Person) => string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title} ({people.length})</CardTitle>
      </CardHeader>
      <CardContent>
        {people.length === 0 && <p className="text-muted-foreground text-sm">{empty}</p>}
        {people.slice(0, 8).map((person) => (
          <Link key={person.id} href={`/members/${person.id}`} className="hover:bg-muted flex items-center gap-4 rounded-md p-2">
            <div>
              <p>{person.name}</p>
              <p className="text-muted-foreground text-sm">{person.phone}</p>
            </div>
            <p className="text-muted-foreground ml-auto text-sm">{describe(person)}</p>
          </Link>
        ))}
        {people.length > 8 && (
          <Link href="/members" className="text-muted-foreground block p-2 text-sm hover:underline">
            and {people.length - 8} more in Members
          </Link>
        )}
      </CardContent>
    </Card>
  )
}

export function SectionCards() {
  const [summary, setSummary] = useState<DashboardSummary>()
  // Front-desk logins see today's cash, not the month's revenue or dues total.
  // Unknown until the session loads, so the card never flashes for staff.
  const [isStaff, setIsStaff] = useState<boolean | null>(null)
  useEffect(() => {
    GetSessionInfo().then((s) => setIsStaff(s?.role === "staff"))
  }, [])

  useEffect(() => {
    GetDashboardSummary().then(setSummary).catch((error) => console.error("Error fetching data:", error))
  }, [])

  const s = summary
  return (
    <>
      <div className="grid grid-cols-2 gap-4 px-4 lg:px-6 @xl/main:grid-cols-3 @5xl/main:grid-cols-6">
        <Stat label="Collected today" value={rupees(s?.collectedToday ?? 0)} href="/payments" />
        {isStaff === false && <Stat
          label="Collected this month"
          value={rupees(s?.collectedThisMonth ?? 0)}
          hint={s ? `${rupees(s.billedThisMonth)} billed` : undefined}
          href="/payments"
        />}
        <Stat
          label="Pending dues"
          value={rupees(s?.totalDue ?? 0)}
          hint={s ? `${s.membersWithDues} member${s.membersWithDues === 1 ? "" : "s"}` : undefined}
          href="/sales/pending-payments"
        />
        <Stat
          label="Active members"
          value={s?.activeMembers ?? 0}
          hint={s ? `of ${s.totalMembers} total` : undefined}
          href="/members"
        />
        <Stat label="Present today" value={s?.presentToday ?? 0} href="/attendance" />
        <Stat
          label="Open enquiries"
          value={s?.openEnquiries ?? 0}
          hint={s ? `${s.followupsToday} to follow up today` : undefined}
          href="/enquiries"
        />
      </div>
      <div className="grid gap-4 px-4 lg:px-6 @3xl/main:grid-cols-2">
        <PeopleCard
          title="Expiring this week"
          empty="No memberships ending in the next 7 days."
          people={s?.expiring ?? []}
          describe={(person) => (person.daysLeft === 0 ? "ends today" : `${person.daysLeft} day${person.daysLeft === 1 ? "" : "s"} left`)}
        />
        <PeopleCard
          title="Expired, not renewed"
          empty="Nobody has lapsed in the last 30 days."
          people={s?.recentlyExpired ?? []}
          describe={(person) => `ended ${person.endDate}`}
        />
      </div>
    </>
  )
}
