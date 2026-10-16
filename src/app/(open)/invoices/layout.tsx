import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

// Invoices are for the gym's own staff; members get the PDF on WhatsApp or email.
export default async function Layout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (!session) redirect("/signin")
    if (!session.gymId) redirect("/admin/gyms")
    return children
}
