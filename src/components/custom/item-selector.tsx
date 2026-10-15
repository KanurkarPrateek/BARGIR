"use client"

import * as React from "react"
import { Check, ChevronsUpDown } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Input } from "../ui/input"

interface Props {
  data: any[]
  onSelect: (value: string) => void
  valueKey: string
  labelKey: string
  placeholder?: string
  searchPlaceholder?: string
  onSelectGetRow?: (row: any) => void
  // Preselects a row (e.g. when arriving from a member's profile).
  defaultValue?: string
}

export default function ItemSelector({
  data,
  onSelect,
  valueKey,
  labelKey,
  placeholder = "Select item...",
  searchPlaceholder = "Search...",
  onSelectGetRow,
  defaultValue
}: Props) {
  const [open, setOpen] = React.useState(false)
  const [value, setValue] = React.useState(defaultValue ?? "")
  React.useEffect(() => {
    if (defaultValue) setValue(defaultValue)
  }, [defaultValue])
  const [search, setSearch] = React.useState("")

  const filteredData = data.filter((row) =>
    String(row[labelKey]).toLowerCase().includes(search.toLowerCase())
  )

  const handleSelect = (currentValue: string, row: any) => {
    setValue(currentValue === value ? "" : currentValue)
    onSelect(currentValue)
    if (onSelectGetRow) {
      onSelectGetRow(row)
    }
    setOpen(false)
    setSearch("")
  }

  return (
    <Popover open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen)
      if (!isOpen) setSearch("")
    }}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="justify-between flex-1"
        >
          {value
            ? data.find((row) => row[valueKey] === value)?.[labelKey]
            : placeholder}
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-full p-0">
        <div className="flex flex-col p-2">
          <Input
            type="text"
            placeholder={searchPlaceholder}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className=""
          />
          <div className="max-h-[200px] overflow-y-auto">
            {filteredData.length === 0 && (
              <div className="px-3 py-2 text-sm text-muted-foreground">
                No results found.
              </div>
            )}
            {filteredData.map((row) => (
              <button
                key={row[valueKey]}
                className={cn(
                  "flex w-full items-center rounded-md px-3 py-2 text-sm text-left hover:bg-accent",
                  value === row[valueKey] && "bg-accent"
                )}
                onClick={() => handleSelect(row[valueKey], row)}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === row[valueKey] ? "opacity-100" : "opacity-0"
                  )}
                />
                {row[labelKey]}
              </button>
            ))}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  )
}