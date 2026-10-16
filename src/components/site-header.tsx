import { Button } from "@/components/ui/button"
import { Separator } from "@/components/ui/separator"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { UniversalSearchBox } from "@/components/universal-search"
import { WhatsappBanner } from "@/components/whatsapp-banner"
import Link from "next/link"

export function SiteHeader({ logo }: { logo?: string | null }) {
  return (
    <header className="flex h-(--header-height) shrink-0 items-center gap-2 border-b transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-(--header-height)">
      <div className="flex w-full items-center gap-2 px-4 lg:px-6">
        <SidebarTrigger className="-ml-1" />
        {logo && (
          <Link href="/dashboard" className="shrink-0 md:hidden">
            <img src={logo} alt="" className="size-8 rounded-md object-contain" />
          </Link>
        )}
        <Separator orientation="vertical" className="mx-1 data-[orientation=vertical]:h-4" />
        <UniversalSearchBox />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          <WhatsappBanner />
          <Link href="/attendance">
            <Button variant={'secondary'} size={'sm'}>
              Attendance
            </Button>
          </Link>
        </div>
      </div>
    </header>
  )
}
