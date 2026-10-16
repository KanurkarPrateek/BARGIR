import { redirect } from "next/navigation"

// The old member portal is switched off; see src/app/user/layout.tsx.
export default function Page() {
  redirect("/signin")
}
