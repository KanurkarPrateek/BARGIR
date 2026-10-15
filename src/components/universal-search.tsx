'use client'
import { SearchHit, UniversalSearch } from "@/action/search.action"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { IconSearch } from "@tabler/icons-react"
import { useRouter } from "next/navigation"
import React, { useEffect, useRef, useState } from "react"

const KIND_LABEL = { member: "Member", enquiry: "Enquiry", staff: "Staff", trainer: "Trainer" }

// "Universal Search Member": find anyone by name, phone, member ID or machine
// ID from any page. Press "/" to jump into it; arrow keys and Enter to open.
export function UniversalSearchBox() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [hits, setHits] = useState<SearchHit[]>([])
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = ["INPUT", "TEXTAREA"].includes((e.target as HTMLElement)?.tagName)
      if (e.key === "/" && !typing) {
        e.preventDefault()
        input.current?.focus()
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (query.trim().length < 2) {
      setHits([])
      return
    }
    // Wait for a pause in typing before searching.
    const timer = setTimeout(async () => {
      setHits(await UniversalSearch(query))
      setActive(0)
      setOpen(true)
    }, 200)
    return () => clearTimeout(timer)
  }, [query])

  const go = (hit: SearchHit) => {
    setOpen(false)
    setQuery("")
    router.push(hit.href)
  }

  return (
    <div className="relative w-full max-w-md">
      <IconSearch className="text-muted-foreground pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2" />
      <Input
        ref={input}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => hits.length && setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") setActive((a) => Math.min(a + 1, hits.length - 1))
          if (e.key === "ArrowUp") setActive((a) => Math.max(a - 1, 0))
          if (e.key === "Enter" && hits[active]) go(hits[active])
          if (e.key === "Escape") setOpen(false)
        }}
        placeholder="Universal Search Member — name, phone or ID  ( / )"
        className="h-9 pl-8"
      />
      {open && query.trim().length >= 2 && (
        <div className="bg-popover absolute z-50 mt-1 w-full overflow-hidden rounded-md border shadow-md">
          {hits.length === 0 && <p className="text-muted-foreground p-3 text-sm">Nobody found for “{query}”.</p>}
          {hits.map((hit, index) => (
            <button
              key={`${hit.kind}-${hit.id}`}
              onMouseDown={() => go(hit)}
              onMouseEnter={() => setActive(index)}
              className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm ${index === active ? "bg-accent" : ""}`}
            >
              <span className="text-muted-foreground w-16 shrink-0 text-xs">{KIND_LABEL[hit.kind]}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium">{hit.title}</span>
                <span className="text-muted-foreground block truncate text-xs">{hit.detail}</span>
              </span>
              {hit.badge && (
                <Badge variant={hit.badge === "BlackList" || hit.badge === "Expired" ? "destructive" : "secondary"} className="ml-auto capitalize">
                  {hit.badge}
                </Badge>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
