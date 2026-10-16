import { AppSidebar } from "@/components/app-sidebar"
import { SiteHeader } from "@/components/site-header"
import {
    SidebarInset,
    SidebarProvider,
} from "@/components/ui/sidebar"
import { getSession } from "@/lib/session"
import { gymBrand } from "@/lib/gym-brand"
import { brandColors, normalizeHex } from "@/lib/brand"
import { redirect } from "next/navigation"


async function Layout({ children }: { children: React.ReactNode }) {
    // Everything under here is a gym's private data.
    const session = await getSession()
    if (!session) redirect("/signin")
    if (!session.gymId) redirect("/admin/gyms")
    const gym = await gymBrand(session.gymId)

    // The gym's brand colour (Gym Settings) for buttons, the active menu item
    // and focus rings; the app's own blue when none is set.
    const brand = normalizeHex(gym?.brandColor)
    const c = brandColors(brand)
    const theme = brand ? `
:root, .dark {
  --primary: ${c.brand}; --primary-foreground: ${c.onBrand}; --ring: ${c.brand};
  --sidebar-primary: ${c.brand}; --sidebar-primary-foreground: ${c.onBrand}; --sidebar-ring: ${c.brand};
  --sidebar-accent: color-mix(in oklab, ${c.brand} 16%, transparent);
  --brand: ${c.brand}; --on-brand: ${c.onBrand};
}
:root { --sidebar-accent-foreground: ${c.ink}; }` : ""

    return (
            <SidebarProvider
                style={
                    {
                        "--sidebar-width": "calc(var(--spacing) * 72)",
                        "--header-height": "calc(var(--spacing) * 12)",
                    } as React.CSSProperties
                }
                >
                {theme && <style>{theme}</style>}
                <AppSidebar variant="inset" />
                <SidebarInset>
                    <SiteHeader logo={gym?.logoUrl ?? null} />
                    <div className="flex flex-1 flex-col">
                        <div className="@container/main flex flex-1 flex-col gap-2">
                            <div className="flex flex-col gap-4 py-4 md:gap-6 md:py-6">
                                {children}
                            </div>
                        </div>
                    </div>
                </SidebarInset>
            </SidebarProvider>
    )
}


export default Layout
