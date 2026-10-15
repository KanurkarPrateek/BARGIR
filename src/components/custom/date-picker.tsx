"use client"

import * as React from "react"
import { format, parse } from "date-fns"
import { CalendarIcon } from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

interface DatePickerDemoProps {
  defaultDate?: string // Format: "dd-MM-yyyy"
  onDateChange?: (date: string) => void
}

export function DatePickerDemo({ defaultDate, onDateChange }: DatePickerDemoProps) {
  // Initialize date state with defaultDate if provided
  const [date, setDate] = React.useState<Date | undefined>(() => {
    if (defaultDate) {
      try {
        return parse(defaultDate, "dd-MM-yyyy", new Date())
      } catch {
        console.error("Invalid defaultDate format. Expected: dd-MM-yyyy")
        return undefined
      }
    }
    return undefined
  })

  // Initialize month and year based on date or current date
  const [month, setMonth] = React.useState<number>(
    date ? date.getMonth() : new Date().getMonth()
  )
  const [year, setYear] = React.useState<number>(
    date ? date.getFullYear() : new Date().getFullYear()
  )

  // Generate arrays for month and year options
  const months = Array.from({ length: 12 }, (_, i) => ({
    value: i,
    label: format(new Date(2023, i), "MMMM"),
  }))
  const years = Array.from({ length: 200 }, (_, i) => {
    const year = new Date().getFullYear() - 100 + i
    return { value: year, label: year.toString() }
  })

  // Handle date selection
  const handleDateChange = (selectedDate: Date) => {
    setDate(selectedDate)
    setMonth(selectedDate.getMonth())
    setYear(selectedDate.getFullYear())
    // console.log(format(selectedDate, "dd-MM-yyyy"))
    if (onDateChange) {
      onDateChange(format(selectedDate, "dd-MM-yyyy"))
    }
  }

  // Handle month/year dropdown changes
  const handleMonthChange = (month: string) => {
    const newMonth = parseInt(month)
    setMonth(newMonth)
    if (date) {
      const newDate = new Date(date)
      newDate.setMonth(newMonth)
      setDate(newDate)
      if (onDateChange) {
        onDateChange(format(newDate, "dd-MM-yyyy"))
      }
    }
  }

  const handleYearChange = (year: string) => {
    const newYear = parseInt(year)
    setYear(newYear)
    if (date) {
      const newDate = new Date(date)
      newDate.setFullYear(newYear)
      setDate(newDate)
      if (onDateChange) {
        onDateChange(format(newDate, "dd-MM-yyyy"))
      }
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={"outline"}
          className={cn(
            "w-[240px] justify-start text-left font-normal",
            !date && "text-muted-foreground"
          )}
        >
          <CalendarIcon className="mr-2 h-4 w-4" />
          {date ? format(date, "PPP") : <span>Pick a date</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex space-x-2 p-2">
          <Select
            onValueChange={handleMonthChange}
            value={month.toString()}
          >
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Month" />
            </SelectTrigger>
            <SelectContent>
              {months.map((m) => (
                <SelectItem key={m.value} value={m.value.toString()}>
                  {m.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            onValueChange={handleYearChange}
            value={year.toString()}
          >
            <SelectTrigger className="w-[100px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map((y) => (
                <SelectItem key={y.value} value={y.value.toString()}>
                  {y.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Calendar
          mode="single"
          selected={date}
          onSelect={handleDateChange as any}
          month={new Date(year, month)}
          onMonthChange={(newMonth) => {
            setMonth(newMonth.getMonth())
            setYear(newMonth.getFullYear())
          }}
          initialFocus
        />
      </PopoverContent>
    </Popover>
  )
}