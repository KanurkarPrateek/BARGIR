'use client'
import { GetSalesAnalytics, SalesAnalytics } from '@/action/analytics.action'
import { call } from '@/lib/action-result'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { paymentModeLabel, rupees } from '@/lib/membership'
import { endOfMonth, format, startOfMonth, startOfYear, subMonths } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'

const fmt = (d: Date) => format(d, 'dd-MM-yyyy')
const PRESETS = [
    { label: 'This month', range: () => [fmt(startOfMonth(new Date())), fmt(new Date())] },
    { label: 'Last month', range: () => [fmt(startOfMonth(subMonths(new Date(), 1))), fmt(endOfMonth(subMonths(new Date(), 1)))] },
    { label: 'Last 3 months', range: () => [fmt(startOfMonth(subMonths(new Date(), 2))), fmt(new Date())] },
    { label: 'This year', range: () => [fmt(startOfYear(new Date())), fmt(new Date())] },
]
const pct = (part: number, whole: number) => (whole ? `${Math.round((part / whole) * 100)}%` : '—')
const SOURCE_LABEL: Record<string, string> = { walkin: 'Walk-in', call: 'Phone call', instagram: 'Instagram', whatsapp: 'WhatsApp' }

// Two validated chart colours (blue = sold, orange = collected), stepped for
// the dark theme as well.
const VIZ_STYLE = `
.viz { --series-1:#2a78d6; --series-2:#eb6834; --grid:#e7e6e2; }
.dark .viz { --series-1:#3987e5; --series-2:#d95926; --grid:#33322f; }
`

function Tile({ label, value, hint }: { label: string; value: string; hint?: string }) {
    return (
        <Card className='gap-1 py-4'>
            <CardHeader className='px-4'>
                <CardDescription>{label}</CardDescription>
                <CardTitle className='text-2xl tabular-nums'>{value}</CardTitle>
                {hint && <CardDescription className='text-xs'>{hint}</CardDescription>}
            </CardHeader>
        </Card>
    )
}

// Horizontal bars for one measure, value written at the end of each bar.
function BarList({ rows }: { rows: { label: string; value: number; note?: string }[] }) {
    const max = Math.max(1, ...rows.map((r) => r.value))
    if (rows.length === 0) return <p className='text-muted-foreground text-sm'>Nothing in this period.</p>
    return (
        <div className='space-y-2'>
            {rows.map((r) => (
                <div key={r.label} className='grid grid-cols-[9rem_1fr] items-center gap-3 text-sm' title={`${r.label}: ${rupees(r.value)}${r.note ? ` · ${r.note}` : ''}`}>
                    <span className='truncate'>{r.label}</span>
                    <div className='flex items-center gap-2'>
                        <div className='h-3 rounded-r-[4px]' style={{ width: `${Math.max(2, (r.value / max) * 100)}%`, background: 'var(--series-1)' }} />
                        <span className='shrink-0 tabular-nums'>{rupees(r.value)}{r.note && <span className='text-muted-foreground'> · {r.note}</span>}</span>
                    </div>
                </div>
            ))}
        </div>
    )
}

// Sold vs collected per month: grouped columns sharing one ₹ axis, with a
// hover read-out for both values and a table alternative.
function MonthlyChart({ months }: { months: SalesAnalytics['months'] }) {
    const [hover, setHover] = useState<number | null>(null)
    const [asTable, setAsTable] = useState(false)
    const max = Math.max(1, ...months.flatMap((m) => [m.sold, m.collected]))
    const H = 160
    return (
        <div className='space-y-3'>
            <div className='flex flex-wrap items-center gap-4 text-sm'>
                <span className='flex items-center gap-1.5'><span className='inline-block size-3 rounded-sm' style={{ background: 'var(--series-1)' }} />Sold</span>
                <span className='flex items-center gap-1.5'><span className='inline-block size-3 rounded-sm' style={{ background: 'var(--series-2)' }} />Collected</span>
                <button className='text-muted-foreground ml-auto text-xs underline' onClick={() => setAsTable(!asTable)}>{asTable ? 'Show chart' : 'Show as table'}</button>
            </div>
            {asTable ? (
                <table className='w-full text-sm'>
                    <thead className='text-muted-foreground text-left'><tr><th>Month</th><th className='pl-4 text-right'>Sold</th><th className='pl-4 text-right'>Collected</th></tr></thead>
                    <tbody>{months.map((m) => <tr key={m.month}><td>{m.month}</td><td className='pl-4 text-right tabular-nums'>{rupees(m.sold)}</td><td className='pl-4 text-right tabular-nums'>{rupees(m.collected)}</td></tr>)}</tbody>
                </table>
            ) : (
                <div className='relative'>
                    <div className='flex items-end gap-2 border-b' style={{ height: H, borderColor: 'var(--grid)' }} onMouseLeave={() => setHover(null)}>
                        {months.map((m, i) => (
                            <div key={m.month} className='flex h-full flex-1 cursor-default items-end justify-center gap-[2px]' onMouseEnter={() => setHover(i)} onFocus={() => setHover(i)} tabIndex={0} aria-label={`${m.month}: sold ${rupees(m.sold)}, collected ${rupees(m.collected)}`}>
                                <div className='w-1/3 max-w-4 rounded-t-[4px]' style={{ height: `${(m.sold / max) * 100}%`, minHeight: m.sold ? 2 : 0, background: 'var(--series-1)', opacity: hover === null || hover === i ? 1 : 0.45 }} />
                                <div className='w-1/3 max-w-4 rounded-t-[4px]' style={{ height: `${(m.collected / max) * 100}%`, minHeight: m.collected ? 2 : 0, background: 'var(--series-2)', opacity: hover === null || hover === i ? 1 : 0.45 }} />
                            </div>
                        ))}
                    </div>
                    <div className='text-muted-foreground mt-1 flex gap-2 text-[10px]'>
                        {months.map((m) => <span key={m.month} className='flex-1 text-center'>{m.month}</span>)}
                    </div>
                    {hover !== null && (
                        <div className='bg-popover pointer-events-none absolute top-0 rounded-md border px-3 py-2 text-xs shadow-md' style={{ left: `min(calc(${((hover + 0.5) / months.length) * 100}% + 8px), calc(100% - 9rem))` }}>
                            <p className='font-medium'>{months[hover].month}</p>
                            <p><strong className='tabular-nums'>{rupees(months[hover].sold)}</strong> sold</p>
                            <p><strong className='tabular-nums'>{rupees(months[hover].collected)}</strong> collected</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}

export default function SalesAnalyticsPage() {
    const [[from, to], setRange] = useState(PRESETS[0].range())
    const [data, setData] = useState<SalesAnalytics | null>(null)

    useEffect(() => {
        call(GetSalesAnalytics(from, to)).then(setData).catch((error) => toast.error(error.message))
    }, [from, to])

    const download = () => {
        if (!data) return
        const sheet = XLSX.utils.json_to_sheet(data.rows.map((r) => ({
            Date: r.date, Member: r.member, Phone: r.phone, Package: r.package, Price: r.price, Discount: r.discount,
            'Net amount': r.net, Paid: r.paid, Due: r.due, Trainer: r.trainer, Type: r.type,
        })))
        const book = XLSX.utils.book_new()
        XLSX.utils.book_append_sheet(book, sheet, 'Subscriptions')
        XLSX.writeFile(book, `sales-${from}-to-${to}.xlsx`)
    }

    const d = data
    return (
        <div className='viz max-w-5xl w-full mx-auto space-y-6 p-4'>
            <style>{VIZ_STYLE}</style>
            <div className='flex flex-wrap items-center justify-between gap-2'>
                <div>
                    <h1 className='text-xl font-semibold'>Sales Analytics</h1>
                    <p className='text-muted-foreground text-sm'>Subscriptions are counted on their start date; collections on the day money was received.</p>
                </div>
                <Button variant='outline' onClick={download} disabled={!d?.rows.length}>Download Excel</Button>
            </div>
            <Separator />
            <div className='flex flex-wrap items-center gap-2'>
                {PRESETS.map((p) => {
                    const [a, b] = p.range()
                    return <Button key={p.label} size='sm' variant={a === from && b === to ? 'default' : 'outline'} onClick={() => setRange([a, b])}>{p.label}</Button>
                })}
                <div className='flex flex-wrap items-center gap-2 text-sm' key={`${from}-${to}`}>
                    <DatePickerDemo defaultDate={from} onDateChange={(v) => setRange([v, to])} /> <span>to</span> <DatePickerDemo defaultDate={to} onDateChange={(v) => setRange([from, v])} />
                </div>
            </div>

            {!d ? <p className='text-muted-foreground text-sm'>Loading…</p> : (
                <>
                    <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                        <Tile label='Sales value' value={rupees(d.salesValue)} hint={`${d.subscriptions} subscription${d.subscriptions === 1 ? '' : 's'}`} />
                        <Tile label='Collected' value={rupees(d.collected)} hint='money received in this period' />
                        <Tile label='New members' value={String(d.newMembers)} hint={`${d.renewals} renewal${d.renewals === 1 ? '' : 's'}`} />
                        <Tile label='Renewal rate' value={pct(d.renewed, d.ended)} hint={`${d.renewed} of ${d.ended} that ended renewed`} />
                        <Tile label='Average sale' value={rupees(d.averageSale)} />
                        <Tile label='Discounts given' value={rupees(d.discounts)} hint={pct(d.discounts, d.salesValue + d.discounts) + ' of list price'} />
                        <Tile label='Outstanding dues' value={rupees(d.outstanding)} hint='all time, still to collect' />
                        <Tile label='Enquiry conversion' value={pct(d.enquiries.joined, d.enquiries.total)} hint={`${d.enquiries.joined} of ${d.enquiries.total} enquiries joined`} />
                    </div>

                    <Card>
                        <CardHeader><CardTitle>Sold vs collected, last 12 months</CardTitle><CardDescription>Hover a month for exact amounts.</CardDescription></CardHeader>
                        <CardContent><MonthlyChart months={d.months} /></CardContent>
                    </Card>

                    <div className='grid gap-4 lg:grid-cols-2'>
                        <Card>
                            <CardHeader><CardTitle>Sales by package</CardTitle><CardDescription>Value sold in this period.</CardDescription></CardHeader>
                            <CardContent className='space-y-4'>
                                <BarList rows={d.packages.filter((p) => p.sold).map((p) => ({ label: p.name, value: p.value, note: `${p.sold} sold` }))} />
                                <table className='w-full text-sm'>
                                    <thead className='text-muted-foreground text-left'><tr><th>Package</th><th className='pl-4 text-right'>Sold</th><th className='pl-4 text-right'>Share</th><th className='pl-4 text-right'>Discount</th><th className='pl-4 text-right'>Members now</th></tr></thead>
                                    <tbody>
                                        {d.packages.map((p) => (
                                            <tr key={p.name}><td className='truncate'>{p.name}</td><td className='pl-4 text-right tabular-nums'>{p.sold}</td><td className='pl-4 text-right tabular-nums'>{p.share}%</td><td className='pl-4 text-right tabular-nums'>{rupees(p.discount)}</td><td className='pl-4 text-right tabular-nums'>{p.activeNow}</td></tr>
                                        ))}
                                    </tbody>
                                </table>
                            </CardContent>
                        </Card>
                        <div className='space-y-4'>
                            <Card>
                                <CardHeader><CardTitle>Collected by payment mode</CardTitle></CardHeader>
                                <CardContent><BarList rows={d.modes.map((m) => ({ label: paymentModeLabel(m.mode), value: m.amount, note: pct(m.amount, d.collected) }))} /></CardContent>
                            </Card>
                            <Card>
                                <CardHeader><CardTitle>New vs renewal</CardTitle></CardHeader>
                                <CardContent className='space-y-2'>
                                    <div className='flex h-3 gap-[2px] overflow-hidden rounded-[4px]'>
                                        {d.subscriptions > 0 && <div style={{ width: `${(d.newMembers / d.subscriptions) * 100}%`, background: 'var(--series-1)' }} />}
                                        {d.subscriptions > 0 && <div style={{ width: `${(d.renewals / d.subscriptions) * 100}%`, background: 'var(--series-2)' }} />}
                                    </div>
                                    <div className='flex justify-between text-sm'>
                                        <span className='flex items-center gap-1.5'><span className='inline-block size-3 rounded-sm' style={{ background: 'var(--series-1)' }} />New {d.newMembers} ({pct(d.newMembers, d.subscriptions)})</span>
                                        <span className='flex items-center gap-1.5'><span className='inline-block size-3 rounded-sm' style={{ background: 'var(--series-2)' }} />Renewal {d.renewals} ({pct(d.renewals, d.subscriptions)})</span>
                                    </div>
                                </CardContent>
                            </Card>
                        </div>
                    </div>

                    <div className='grid gap-4 lg:grid-cols-2'>
                        <Card>
                            <CardHeader><CardTitle>Enquiries by source</CardTitle><CardDescription>{d.enquiries.open} still open, {d.enquiries.lost} lost.</CardDescription></CardHeader>
                            <CardContent>
                                {d.enquiries.bySource.length === 0 ? <p className='text-muted-foreground text-sm'>No enquiries in this period.</p> : (
                                    <table className='w-full text-sm'>
                                        <thead className='text-muted-foreground text-left'><tr><th>Source</th><th className='pl-4 text-right'>Enquiries</th><th className='pl-4 text-right'>Joined</th><th className='pl-4 text-right'>Conversion</th></tr></thead>
                                        <tbody>{d.enquiries.bySource.map((s) => <tr key={s.source}><td>{SOURCE_LABEL[s.source] ?? s.source}</td><td className='pl-4 text-right tabular-nums'>{s.total}</td><td className='pl-4 text-right tabular-nums'>{s.joined}</td><td className='pl-4 text-right tabular-nums'>{pct(s.joined, s.total)}</td></tr>)}</tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader><CardTitle>Sales by trainer</CardTitle><CardDescription>Packages sold with a trainer (personal training).</CardDescription></CardHeader>
                            <CardContent>
                                {d.trainers.length === 0 ? <p className='text-muted-foreground text-sm'>No trainer sales in this period.</p> : (
                                    <table className='w-full text-sm'>
                                        <thead className='text-muted-foreground text-left'><tr><th>Trainer</th><th className='pl-4 text-right'>Sold</th><th className='pl-4 text-right'>Value</th></tr></thead>
                                        <tbody>{d.trainers.map((t) => <tr key={t.name}><td>{t.name}</td><td className='pl-4 text-right tabular-nums'>{t.sold}</td><td className='pl-4 text-right tabular-nums'>{rupees(t.value)}</td></tr>)}</tbody>
                                    </table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </>
            )}
        </div>
    )
}
