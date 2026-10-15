'use client'
import { GetPayments, PaymentResponse } from '@/action/payment.action'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { PAYMENT_MODES, paymentModeLabel, rupees } from '@/lib/membership'
import { format, startOfMonth, subDays } from 'date-fns'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

const fmt = (date: Date) => format(date, 'dd-MM-yyyy')

const PRESETS = [
    { label: 'Today', range: () => [fmt(new Date()), fmt(new Date())] },
    { label: 'Yesterday', range: () => [fmt(subDays(new Date(), 1)), fmt(subDays(new Date(), 1))] },
    { label: 'Last 7 days', range: () => [fmt(subDays(new Date(), 6)), fmt(new Date())] },
    { label: 'This month', range: () => [fmt(startOfMonth(new Date())), fmt(new Date())] },
]

const PaymentsPage = () => {
    const [from, setFrom] = useState(fmt(new Date()))
    const [to, setTo] = useState(fmt(new Date()))
    const [data, setData] = useState<{ payments: PaymentResponse[]; total: number; byMode: Record<string, number> }>()

    useEffect(() => {
        if (from && to) GetPayments(from, to).then(setData)
    }, [from, to])

    return (
        <div className='max-w-2xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Payment Report</h1>
                <p className='text-muted-foreground text-sm'>Every rupee collected, by day and by how it was paid. Use it to tally the cash drawer.</p>
            </div>
            <Separator />
            <div className='flex flex-wrap gap-2'>
                {PRESETS.map((preset) => {
                    const [start, end] = preset.range()
                    return (
                        <Button
                            key={preset.label}
                            size='sm'
                            variant={start === from && end === to ? 'default' : 'outline'}
                            onClick={() => { setFrom(start); setTo(end) }}
                        >
                            {preset.label}
                        </Button>
                    )
                })}
            </div>
            {/* Keyed so the pickers follow the preset buttons. */}
            <div className='flex flex-wrap items-center gap-2 text-sm' key={`${from}-${to}`}>
                <DatePickerDemo defaultDate={from} onDateChange={setFrom} />
                <span>to</span>
                <DatePickerDemo defaultDate={to} onDateChange={setTo} />
            </div>

            <div className='grid grid-cols-2 gap-4 md:grid-cols-3'>
                <Card>
                    <CardHeader>
                        <CardDescription>Total collected</CardDescription>
                        <CardTitle className='text-2xl'>{rupees(data?.total ?? 0)}</CardTitle>
                        <CardDescription>{data?.payments.length ?? 0} payments</CardDescription>
                    </CardHeader>
                </Card>
                {PAYMENT_MODES.filter((mode) => data?.byMode[mode.value]).map((mode) => (
                    <Card key={mode.value}>
                        <CardHeader>
                            <CardDescription>{mode.label}</CardDescription>
                            <CardTitle className='text-2xl'>{rupees(data!.byMode[mode.value])}</CardTitle>
                        </CardHeader>
                    </Card>
                ))}
            </div>

            <div>
                {data?.payments.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No payments in this period.</p>}
                {data?.payments.map((payment) => (
                    <Link key={payment.id} href={`/members/${payment.member_id}`} className='hover:bg-muted flex items-center gap-4 rounded-md p-2'>
                        <div>
                            <p>{payment.member_name}</p>
                            <p className='text-muted-foreground text-sm'>
                                {payment.date} · {payment.service_name}
                                {payment.note && ` · ${payment.note}`}
                            </p>
                        </div>
                        <p className='ml-auto text-right'>
                            {rupees(payment.amount)}
                            <span className='text-muted-foreground block text-sm'>{paymentModeLabel(payment.mode)}</span>
                        </p>
                    </Link>
                ))}
            </div>
        </div>
    )
}

export default PaymentsPage
