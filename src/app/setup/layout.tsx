import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

// The setup wizard is for the gym owner, without the sidebar so the next step
// is always obvious.
export default async function SetupLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (!session?.gymId) redirect("/signin")
    if (session.role === "staff") redirect("/dashboard")
    return <div className="bg-muted/30 min-h-svh">{children}</div>
}
