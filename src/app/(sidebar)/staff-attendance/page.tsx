'use client'
import { GetStaffAttendance, GetStaffList, MarkStaffAttendance, StaffAttendanceRow, StaffRow } from '@/action/team.action'
import { call } from '@/lib/action-result'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { format, startOfMonth } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const fmt = (d: Date) => format(d, 'dd-MM-yyyy')
const short = (t: string | null) => (t ? t.slice(0, 5) : '—')

// Staff Attendance: one tap marks someone in, a second tap marks them out.
// Staff enrolled on the biometric machine are marked automatically.
const StaffAttendancePage = () => {
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [rows, setRows] = useState<StaffAttendanceRow[]>([])
    const [from, setFrom] = useState(fmt(startOfMonth(new Date())))
    const [to, setTo] = useState(fmt(new Date()))

    const load = async () => {
        setStaff((await GetStaffList()).filter((s) => s.active))
        setRows(await GetStaffAttendance(from, to))
    }
    useEffect(() => { load() }, [from, to])

    const mark = async (s: StaffRow) => {
        try {
            const result = await call(MarkStaffAttendance(s.id))
            toast.success(`${s.name} marked ${result}`)
            load()
        } catch (error: any) { toast.error(error.message) }
    }

    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Staff Attendance</h1>
                <p className='text-muted-foreground text-sm'>Tap once when someone arrives and again when they leave. Biometric punches fill this in by themselves.</p>
            </div>
            <Separator />
            <Card>
                <CardHeader><CardTitle>Today</CardTitle></CardHeader>
                <CardContent className='space-y-2'>
                    {staff.length === 0 && <p className='text-muted-foreground text-sm'>Add staff under Staff Management first.</p>}
                    {staff.map((s) => (
                        <div key={s.id} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                            <div>
                                <p className='font-medium'>{s.name}</p>
                                <p className='text-muted-foreground text-xs'>{s.role}{s.shiftStart && ` · shift ${s.shiftStart}–${s.shiftEnd}`}</p>
                            </div>
                            <span className='ml-auto text-sm'>{s.todayIn ? `In ${short(s.todayIn)} · Out ${short(s.todayOut)}` : 'Not in yet'}</span>
                            <Button size='sm' variant={s.todayIn ? 'outline' : 'default'} onClick={() => mark(s)}>
                                {s.todayIn ? 'Mark out' : 'Mark in'}
                            </Button>
                        </div>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <CardTitle>History</CardTitle>
                    <CardDescription>Late means more than 5 minutes after the shift start.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    <div className='flex flex-wrap items-center gap-2 text-sm' key={`${from}-${to}`}>
                        <DatePickerDemo defaultDate={from} onDateChange={setFrom} /> <span>to</span> <DatePickerDemo defaultDate={to} onDateChange={setTo} />
                    </div>
                    {rows.length === 0 && <p className='text-muted-foreground text-sm'>No attendance in this period.</p>}
                    {rows.map((r) => (
                        <div key={r.id} className='flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted'>
                            <span className='w-24'>{r.date}</span>
                            <span className='font-medium'>{r.name}</span>
                            {r.lateBy && <Badge variant='destructive'>Late {r.lateBy} min</Badge>}
                            <span className='text-muted-foreground ml-auto'>In {short(r.inTime)} · Out {short(r.outTime)}</span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

export default StaffAttendancePage
