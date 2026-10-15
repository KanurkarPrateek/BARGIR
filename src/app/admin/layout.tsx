import { getSession } from "@/lib/session"
import { redirect } from "next/navigation"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    const session = await getSession()
    if (session?.role !== "superadmin") redirect("/signin")
    return <>{children}</>
}
