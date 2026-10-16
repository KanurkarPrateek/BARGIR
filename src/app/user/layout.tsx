import { redirect } from "next/navigation"

// The old member portal is switched off: it had no real sign-in (a shared
// default password and the member id in the browser). Members get their
// invoices and reminders on WhatsApp instead.
export default function Layout(_: { children: React.ReactNode }) {
  redirect("/signin")
}
