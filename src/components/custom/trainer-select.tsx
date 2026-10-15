'use client'
import { GetTrainers, TrainerResponse } from "@/action/trainer.action"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import React, { useEffect, useState } from "react"

interface Props {
  value: string | null | undefined
  onChange: (trainerId: string | null) => void
  className?: string
}

// The select needs a real value for "nobody".
const NONE = "none"

export function TrainerSelect({ value, onChange, className = "w-full" }: Props) {
  const [trainers, setTrainers] = useState<TrainerResponse[]>([])
  useEffect(() => {
    GetTrainers().then(setTrainers)
  }, [])

  return (
    <Select value={value || NONE} onValueChange={(v) => onChange(v === NONE ? null : v)}>
      <SelectTrigger className={className}><SelectValue /></SelectTrigger>
      <SelectContent>
        <SelectItem value={NONE}>No trainer</SelectItem>
        {trainers
          // Keep showing a deactivated trainer who is still assigned.
          .filter((trainer) => trainer.active || trainer.id === value)
          .map((trainer) => (
            <SelectItem key={trainer.id} value={trainer.id}>{trainer.name}</SelectItem>
          ))}
      </SelectContent>
    </Select>
  )
}
