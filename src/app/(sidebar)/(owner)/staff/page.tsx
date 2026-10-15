'use client'
import { GetStaffList, RemoveStaffLogin, SaveStaff, SetStaffLogin, StaffInput, StaffRow } from '@/action/team.action'
import { call } from '@/lib/action-result'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { capitalizeWords } from '@/lib/utils'
import { format } from 'date-fns'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useState } from 'react'
import { toast } from 'sonner'

const ROLES = ['Front desk', 'Manager', 'Housekeeping', 'Security', 'Nutritionist']
const EMPTY = (): StaffInput => ({ name: '', phone: '', role: 'Front desk', shiftStart: '06:00', shiftEnd: '14:00', salary: null, joinDate: format(new Date(), 'dd-MM-yyyy'), active: true })

function StaffManagement() {
    const params = useSearchParams()
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [editing, setEditing] = useState<StaffInput | null>(params.get('add') ? EMPTY() : null)
    const [loginFor, setLoginFor] = useState<StaffRow | null>(null)
    const [password, setPassword] = useState('')
    const load = async () => setStaff(await GetStaffList())
    useEffect(() => { load() }, [])

    const save = async () => {
        try {
            await call(SaveStaff(editing!))
            toast.success('Staff saved')
            setEditing(null)
            load()
        } catch (error: any) { toast.error(error.message) }
    }
    const saveLogin = async () => {
        try {
            await call(SetStaffLogin(loginFor!.id, password))
            toast.success(`${loginFor!.name} can now sign in with ${loginFor!.phone}`)
            setLoginFor(null); setPassword(''); load()
        } catch (error: any) { toast.error(error.message) }
    }
    const removeLogin = async (s: StaffRow) => {
        if (!confirm(`Stop ${s.name} from signing in?`)) return
        try { await call(RemoveStaffLogin(s.id)); load() } catch (error: any) { toast.error(error.message) }
    }

    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-xl font-semibold'>View Staff</h1>
                    <p className='text-muted-foreground text-sm'>Everyone who works here. Trainers are under Trainer Management.</p>
                </div>
                <div className='flex gap-2'>
                    <Link href='/staff-attendance'><Button variant='outline'>Staff Attendance</Button></Link>
                    <Button onClick={() => setEditing(EMPTY())}>Add Staff</Button>
                </div>
            </div>
            <Separator />
            {staff.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No staff added yet.</p>}
            {staff.map((s) => (
                <div key={s.id} className='space-y-2 rounded-lg border p-4'>
                    <div className='flex flex-wrap items-start gap-2'>
                        <div>
                            <p className='font-medium'>{s.name} <span className='text-muted-foreground font-normal'>· {s.role}</span></p>
                            <p className='text-muted-foreground text-sm'>
                                {s.phone}
                                {s.shiftStart && ` · shift ${s.shiftStart}–${s.shiftEnd}`}
                                {s.salary ? ` · ₹${s.salary.toLocaleString('en-IN')}/month` : ''}
                                {s.biometricId && ` · machine ID ${s.biometricId}`}
                            </p>
                        </div>
                        <span className='ml-auto flex flex-wrap gap-1'>
                            {!s.active && <Badge variant='outline'>Left</Badge>}
                            {s.todayIn && <Badge variant='secondary'>In {s.todayIn.slice(0, 5)}{s.todayOut ? ` · Out ${s.todayOut.slice(0, 5)}` : ''}</Badge>}
                            {s.hasLogin && <Badge>Can sign in</Badge>}
                        </span>
                    </div>
                    <div className='flex flex-wrap gap-2'>
                        <Button size='sm' variant='outline' onClick={() => setEditing({ ...s })}>Edit</Button>
                        {s.active && <Button size='sm' variant='outline' onClick={() => setLoginFor(s)}>{s.hasLogin ? 'Reset password' : 'Give login'}</Button>}
                        {s.hasLogin && <Button size='sm' variant='ghost' className='text-destructive' onClick={() => removeLogin(s)}>Remove login</Button>}
                    </div>
                </div>
            ))}

            <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent className='max-h-[90vh] overflow-y-auto'>
                    <DialogHeader><DialogTitle>{editing?.id ? 'Edit staff' : 'Add Staff'}</DialogTitle></DialogHeader>
                    {editing && (
                        <div className='space-y-4'>
                            <div className='space-y-2'><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: capitalizeWords(e.target.value) })} /></div>
                            <div className='space-y-2'><Label>Mobile number</Label><Input type='tel' placeholder='10 digit mobile number' value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} /></div>
                            <div className='space-y-2'>
                                <Label>Role</Label>
                                <Input list='staff-roles' value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value })} />
                                <datalist id='staff-roles'>{ROLES.map((r) => <option key={r} value={r} />)}</datalist>
                            </div>
                            <div className='grid grid-cols-2 gap-4'>
                                <div className='space-y-2'><Label>Shift starts</Label><Input type='time' value={editing.shiftStart ?? ''} onChange={(e) => setEditing({ ...editing, shiftStart: e.target.value })} /></div>
                                <div className='space-y-2'><Label>Shift ends</Label><Input type='time' value={editing.shiftEnd ?? ''} onChange={(e) => setEditing({ ...editing, shiftEnd: e.target.value })} /></div>
                            </div>
                            <div className='space-y-2'><Label>Monthly salary <span className='text-muted-foreground font-normal'>(optional)</span></Label><Input type='number' value={editing.salary ?? ''} onChange={(e) => setEditing({ ...editing, salary: Number(e.target.value) || null })} /></div>
                            <div className='space-y-2'><Label>Joining date</Label><DatePickerDemo defaultDate={editing.joinDate} onDateChange={(d) => setEditing({ ...editing, joinDate: d })} /></div>
                            <div className='flex items-center justify-between'><Label>Currently working here</Label><Switch checked={editing.active} onCheckedChange={(active) => setEditing({ ...editing, active })} /></div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!loginFor} onOpenChange={(o) => !o && setLoginFor(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Login for {loginFor?.name}</DialogTitle>
                        <DialogDescription>
                            They sign in at /signin with {loginFor?.phone} and this password. Front-desk logins can add members, enquiries,
                            subscriptions and attendance, and collect payments, but cannot see reports, expenses, staff or settings.
                        </DialogDescription>
                    </DialogHeader>
                    <div className='space-y-2'><Label>Password</Label><Input placeholder='At least 8 characters' value={password} onChange={(e) => setPassword(e.target.value)} /></div>
                    <DialogFooter><Button onClick={saveLogin} disabled={password.length < 8}>Save</Button></DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default function StaffPage() {
    return <Suspense><StaffManagement /></Suspense>
}
