'use client'
import { GetSessionInfo } from "@/action/staff.action"
import { GetWhatsappConnection } from "@/action/whatsapp.action"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { useEffect, useState } from "react"

// Tells the owner, on every page, when the gym's WhatsApp is not linked, so
// automatic messages are not silently piling up unsent.
export function WhatsappBanner() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const session = await GetSessionInfo()
      if (!session || session.role === "staff") return
      const connection = await GetWhatsappConnection().catch(() => null)
      // A sleeping sender reports "offline"; only a missing link is worth a banner.
      if (!cancelled && connection?.state === "qr") setShow(true)
    })()
    return () => {
      cancelled = true
    }
  }, [])
  if (!show) return null
  return (
    <div className="flex items-center gap-2 rounded-md bg-red-50 px-3 py-1 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
      <span>WhatsApp is not connected</span>
      <Link href="/whatsapp">
        <Button size="sm" variant="destructive" className="h-7">Scan Now</Button>
      </Link>
    </div>
  )
}
