'use client'
import { call } from '@/lib/action-result'
import { RecordPayment } from "@/action/payment.action"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PAYMENT_MODES, PaymentMode, rupees } from "@/lib/membership"
import React from "react"
import { format } from "date-fns"
import { DatePickerDemo } from "@/components/custom/date-picker"
import { toast } from "sonner"

interface Props {
  sale: { id: string; due: number; service_name: string; member_name?: string }
  onSuccess?: () => void
  label?: string
  // BackDate: let the person pick the day the money was received.
  withDate?: boolean
}

export function RecordPaymentDialog({ sale, onSuccess, label = "Collect", withDate = false }: Props) {
  const [open, setOpen] = React.useState(false)
  // Most people clear the whole balance, so start there.
  const [amount, setAmount] = React.useState(sale.due)
  const [mode, setMode] = React.useState<PaymentMode>("cash")
  const [note, setNote] = React.useState("")
  const [date, setDate] = React.useState(format(new Date(), "dd-MM-yyyy"))
  const [saving, setSaving] = React.useState(false)

  React.useEffect(() => {
    if (open) setAmount(sale.due)
  }, [open, sale.due])

  const handleSubmit = async () => {
    setSaving(true)
    try {
      await call(RecordPayment({ sale_id: sale.id, amount, mode, note, date }))
      toast.success(`${rupees(amount)} received`)
      setNote("")
      setOpen(false)
      onSuccess?.()
    } catch (error: any) {
      toast.error(error.message)
    }
    setSaving(false)
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">{label}</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Collect payment</DialogTitle>
          <DialogDescription>
            {rupees(sale.due)} due for {sale.service_name}
            {sale.member_name && ` from ${sale.member_name}`}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Amount received</Label>
            <Input
              type="number"
              min={1}
              max={sale.due}
              value={amount || ""}
              onChange={(e) => setAmount(Number(e.target.value))}
            />
          </div>
          <div className="space-y-2">
            <Label>Paid by</Label>
            <Select value={mode} onValueChange={(value) => setMode(value as PaymentMode)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {PAYMENT_MODES.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {withDate && (
            <div className="space-y-2">
              <Label>Date received</Label>
              <DatePickerDemo defaultDate={date} onDateChange={setDate} />
              <p className="text-muted-foreground text-xs">A past date counts as an old record: no receipt is sent.</p>
            </div>
          )}
          <div className="space-y-2">
            <Label>Note</Label>
            <Input placeholder="e.g. UPI reference" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button onClick={handleSubmit} disabled={saving || !(amount > 0)}>Save payment</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
