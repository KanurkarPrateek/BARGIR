import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

// Money reports, setup, staff and WhatsApp are for the gym owner; front-desk
// logins are sent back to the dashboard. (The actions behind these pages
// check the same thing on the server.)
export default async function OwnerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession()
  if (session?.role === "staff") redirect("/dashboard")
  return <>{children}</>
}
