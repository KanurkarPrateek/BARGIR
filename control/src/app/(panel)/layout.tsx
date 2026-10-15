import Link from "next/link";
import { requireUser } from "@/lib/auth";
import { signOutAction } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const links = user.role === "admin"
    ? [["/", "Dashboard"], ["/gyms", "Gyms"], ["/billing", "Billing"], ["/clusters", "Clusters"], ["/team", "Sales team"]]
    : [["/", "Dashboard"], ["/gyms", "My gyms"], ["/commission", "My commission"]];
  return (
    <div className="min-h-screen">
      <header className="border-b border-stone-200 bg-white dark:border-stone-800 dark:bg-stone-900">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold">Control Panel</Link>
          <nav className="flex flex-wrap gap-4 text-sm">
            {links.map(([href, label]) => <Link key={href} href={href} className="text-stone-600 hover:text-stone-900 dark:text-stone-400 dark:hover:text-white">{label}</Link>)}
          </nav>
          <form action={signOutAction} className="ml-auto flex items-center gap-3 text-sm">
            <span className="text-stone-500">{user.name} · {user.role === "admin" ? "Admin" : "Sales"}</span>
            <button className="underline">Sign out</button>
          </form>
        </div>
      </header>
      <main className="mx-auto max-w-6xl space-y-6 px-4 py-6">{children}</main>
    </div>
  );
}
