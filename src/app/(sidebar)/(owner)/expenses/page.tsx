'use client'
import { AddExpense, DeleteExpense, ExpenseRow, GetExpenses, GetProfitByMonth, ProfitMonth } from '@/action/expense.action'
import { call } from '@/lib/action-result'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { PAYMENT_MODES, PaymentMode, paymentModeLabel, rupees } from '@/lib/membership'
import { format, startOfMonth } from 'date-fns'
import { useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const CATEGORIES = ['Rent', 'Salary', 'Electricity', 'Water', 'Equipment', 'Repairs', 'Cleaning', 'Marketing', 'Internet', 'Other']
const fmt = (d: Date) => format(d, 'dd-MM-yyyy')

function ExpenseManagement() {
    const params = useSearchParams()
    const amountInput = useRef<HTMLInputElement>(null)
    const [form, setForm] = useState({ category: 'Rent', amount: 0, date: fmt(new Date()), mode: 'cash' as PaymentMode, note: '' })
    const [formKey, setFormKey] = useState(0)
    const [from, setFrom] = useState(fmt(startOfMonth(new Date())))
    const [to, setTo] = useState(fmt(new Date()))
    const [data, setData] = useState<{ rows: ExpenseRow[]; total: number; byCategory: Record<string, number> }>()
    const [profit, setProfit] = useState<ProfitMonth[]>([])

    const load = async () => {
        setData(await call(GetExpenses(from, to)).catch(() => undefined))
        setProfit(await call(GetProfitByMonth()).catch(() => []))
    }
    useEffect(() => { load() }, [from, to])
    useEffect(() => { if (params.get('add')) amountInput.current?.focus() }, [])

    const add = async () => {
        try {
            await call(AddExpense(form))
            toast.success(`${rupees(form.amount)} ${form.category} added`)
            setForm({ ...form, amount: 0, note: '' })
            setFormKey((k) => k + 1)
            load()
        } catch (error: any) { toast.error(error.message) }
    }
    const remove = async (e: ExpenseRow) => {
        if (!confirm(`Delete ${rupees(e.amount)} ${e.category} on ${e.date}?`)) return
        try { await call(DeleteExpense(e.id)); load() } catch (error: any) { toast.error(error.message) }
    }

    const thisMonth = profit[0]
    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Expense Management</h1>
                <p className='text-muted-foreground text-sm'>Money going out, and what is left after it.</p>
            </div>
            <Separator />
            {thisMonth && (
                <div className='grid grid-cols-3 gap-4'>
                    <Card><CardHeader><CardDescription>Collected · {thisMonth.month}</CardDescription><CardTitle className='text-xl'>{rupees(thisMonth.collected)}</CardTitle></CardHeader></Card>
                    <Card><CardHeader><CardDescription>Spent</CardDescription><CardTitle className='text-xl'>{rupees(thisMonth.spent)}</CardTitle></CardHeader></Card>
                    <Card><CardHeader><CardDescription>Profit</CardDescription><CardTitle className={`text-xl ${thisMonth.profit < 0 ? 'text-destructive' : ''}`}>{rupees(thisMonth.profit)}</CardTitle></CardHeader></Card>
                </div>
            )}
            <Card>
                <CardHeader><CardTitle>Add Expense</CardTitle></CardHeader>
                <CardContent className='grid gap-4 md:grid-cols-2' key={formKey}>
                    <div className='space-y-2'>
                        <Label>What for</Label>
                        <Input list='expense-categories' value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} />
                        <datalist id='expense-categories'>{CATEGORIES.map((c) => <option key={c} value={c} />)}</datalist>
                    </div>
                    <div className='space-y-2'><Label>Amount</Label><Input ref={amountInput} type='number' min={1} value={form.amount || ''} onChange={(e) => setForm({ ...form, amount: Number(e.target.value) })} /></div>
                    <div className='space-y-2'><Label>Date</Label><DatePickerDemo defaultDate={form.date} onDateChange={(d) => setForm({ ...form, date: d })} /></div>
                    <div className='space-y-2'>
                        <Label>Paid by</Label>
                        <Select value={form.mode} onValueChange={(v) => setForm({ ...form, mode: v as PaymentMode })}>
                            <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                            <SelectContent>{PAYMENT_MODES.map((m) => <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                    <div className='space-y-2 md:col-span-2'><Label>Note</Label><Input placeholder='e.g. October rent' value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} /></div>
                    <Button className='md:w-fit' onClick={add} disabled={!(form.amount > 0)}>Add Expense</Button>
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>View Expense</CardTitle>
                    <CardDescription>{data ? `${rupees(data.total)} in this period` : ''}</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='flex flex-wrap items-center gap-2 text-sm' key={`${from}-${to}`}>
                        <DatePickerDemo defaultDate={from} onDateChange={setFrom} /> <span>to</span> <DatePickerDemo defaultDate={to} onDateChange={setTo} />
                    </div>
                    {data && Object.keys(data.byCategory).length > 0 && (
                        <div className='flex flex-wrap gap-2 text-sm'>
                            {Object.entries(data.byCategory).sort((a, b) => b[1] - a[1]).map(([c, v]) => (
                                <span key={c} className='bg-muted rounded-md px-2 py-1'>{c}: <strong>{rupees(v)}</strong></span>
                            ))}
                        </div>
                    )}
                    {data?.rows.length === 0 && <p className='text-muted-foreground text-sm'>No expenses in this period.</p>}
                    {data?.rows.map((e) => (
                        <div key={e.id} className='flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted'>
                            <span className='w-24'>{e.date}</span>
                            <span><span className='font-medium'>{e.category}</span>{e.note && <span className='text-muted-foreground'> · {e.note}</span>}</span>
                            <span className='ml-auto text-right'>{rupees(e.amount)}<span className='text-muted-foreground block text-xs'>{paymentModeLabel(e.mode)}</span></span>
                            <Button size='sm' variant='ghost' className='text-destructive' onClick={() => remove(e)}>Delete</Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader><CardTitle>Profit by month</CardTitle><CardDescription>Collected (payments received) minus spent.</CardDescription></CardHeader>
                <CardContent>
                    <div className='grid grid-cols-4 gap-y-2 text-sm'>
                        <span className='text-muted-foreground'>Month</span><span className='text-muted-foreground text-right'>Collected</span><span className='text-muted-foreground text-right'>Spent</span><span className='text-muted-foreground text-right'>Profit</span>
                        {profit.map((m) => (
                            <React.Fragment key={m.month}>
                                <span>{m.month}</span><span className='text-right'>{rupees(m.collected)}</span><span className='text-right'>{rupees(m.spent)}</span>
                                <span className={`text-right font-medium ${m.profit < 0 ? 'text-destructive' : ''}`}>{rupees(m.profit)}</span>
                            </React.Fragment>
                        ))}
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}

export default function ExpensesPage() {
    return <Suspense><ExpenseManagement /></Suspense>
}
