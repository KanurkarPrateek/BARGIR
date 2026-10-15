'use client'
import { call } from '@/lib/action-result'
import {
    AddMemberToMachines,
    AddStaffToMachines,
    CommandRow,
    DeleteFromMachines,
    DeviceResponse,
    GetAutoBlock,
    GetCommands,
    GetDevices,
    GetLinkedPeople,
    GetServerAddress,
    GetUnlinkedIds,
    ImportPunchFile,
    LinkBiometricId,
    LinkedPerson,
    PersonKind,
    RegisterDevice,
    RemoveDevice,
    RemoveMemberFromMachines,
    RequestMachineUserList,
    ServerAddress,
    SetAutoBlock,
    UnlinkBiometricId,
    UnlinkedId,
} from '@/action/biometric.action'
import { GetMemberList, MemberListRow } from '@/action/profile.action'
import { ClaimMachine, GetUnclaimedMachines } from '@/action/onboarding.action'
import { GetSessionInfo } from '@/action/staff.action'
import { GetStaffList, StaffRow } from '@/action/team.action'
import ItemSelector from '@/components/custom/item-selector'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { formatDistanceToNow } from 'date-fns'
import { useRouter, useSearchParams } from 'next/navigation'
import React, { Suspense, useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'

const ENROLL_HINT = (pin: string) => `On the machine open User Management, find ID ${pin} and enroll the fingerprint.`
const STATUS_BADGE = { pending: 'outline', sent: 'secondary', done: 'default', failed: 'destructive' } as const
const STATUS_LABEL = { pending: 'Waiting for machine', sent: 'Sent to machine', done: 'Done', failed: 'Failed' }

function BiometricManagement() {
    const router = useRouter()
    const params = useSearchParams()
    const tab = params.get('tab') ?? 'enroll'
    const [isOwner, setIsOwner] = useState(false)
    const [server, setServer] = useState<ServerAddress>({ address: null, port: null, isDomain: false })
    const [devices, setDevices] = useState<DeviceResponse[]>([])
    const [members, setMembers] = useState<MemberListRow[]>([])
    const [staff, setStaff] = useState<StaffRow[]>([])
    const [unlinked, setUnlinked] = useState<UnlinkedId[]>([])
    const [linked, setLinked] = useState<LinkedPerson[]>([])
    const [commands, setCommands] = useState<CommandRow[]>([])
    const [autoBlock, setAutoBlockState] = useState(false)
    const [newSerial, setNewSerial] = useState('')
    const [pickMember, setPickMember] = useState('')
    const [pickStaff, setPickStaff] = useState('')
    const [choices, setChoices] = useState<Record<string, string>>({})
    const [port, setPort] = useState('')
    const [unclaimed, setUnclaimed] = useState<{ serial: string; lastSeenAt: Date | null }[]>([])
    const fileInput = useRef<HTMLInputElement>(null)

    const load = async () => {
        const [d, m, s, u, l, c] = await Promise.all([GetDevices(), GetMemberList(), GetStaffList(), GetUnlinkedIds(), GetLinkedPeople(), GetCommands()])
        setDevices(d); setMembers(m); setStaff(s); setUnlinked(u); setLinked(l); setCommands(c)
        setUnclaimed(await GetUnclaimedMachines())
    }
    useEffect(() => {
        load()
        GetServerAddress().then(setServer)
        GetAutoBlock().then(setAutoBlockState)
        GetSessionInfo().then((s) => setIsOwner(!!s && s.role !== 'staff'))
        setPort(window.location.port || (window.location.protocol === 'https:' ? '443' : '80'))
        // Command results and new punches arrive while the page is open.
        const timer = setInterval(load, 10000)
        return () => clearInterval(timer)
    }, [])

    const run = async (fn: () => Promise<unknown>, done?: string) => {
        try {
            await fn()
            if (done) toast.success(done)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }
    const enrollMember = async (id: string) => {
        try {
            const pin = await call(AddMemberToMachines(id))
            toast.success(`Sent to the machine as ID ${pin}`, { description: ENROLL_HINT(pin), duration: 10000 })
            setPickMember(''); load()
        } catch (error: any) { toast.error(error.message) }
    }
    const enrollStaff = async (id: string) => {
        try {
            const pin = await call(AddStaffToMachines(id))
            toast.success(`Sent to the machine as ID ${pin}`, { description: ENROLL_HINT(pin), duration: 10000 })
            setPickStaff(''); load()
        } catch (error: any) { toast.error(error.message) }
    }
    const link = (pin: string, choice: string) => {
        const [kind, id] = choice.split(':') as [PersonKind, string]
        run(async () => {
            const count = await call(LinkBiometricId(pin, id, kind))
            toast.success(`Linked. ${count ? `Attendance marked for ${count} day(s).` : ''}`)
        })
    }

    const onMachine = members.filter((m) => m.biometricId && !m.machineBlocked && !m.blacklisted)
    const blocked = members.filter((m) => m.biometricId && m.machineBlocked)
    const people = [
        ...members.map((m) => ({ value: `member:${m.id}`, label: `${m.name} (member)` })),
        ...staff.filter((s) => s.active).map((s) => ({ value: `staff:${s.id}`, label: `${s.name} (staff)` })),
    ]
    const notEnrolled = members.filter((m) => !m.biometricId && !m.blacklisted)

    return (
        <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>Biometric Management</h1>
                <p className='text-muted-foreground text-sm'>
                    {devices.length === 0 ? 'No machine added yet.' : `${devices.length} machine${devices.length > 1 ? 's' : ''}: ${devices.map((d) => `${d.serial} (${d.lastSeenAt ? `seen ${formatDistanceToNow(d.lastSeenAt, { addSuffix: true })}` : 'not connected yet'})`).join(', ')}`}
                </p>
            </div>
            <Separator />
            <Tabs value={tab} onValueChange={(v) => router.replace(`/attendance/biometric?tab=${v}`)}>
                <TabsList className='flex-wrap'>
                    <TabsTrigger value='enroll'>Add Biometric</TabsTrigger>
                    <TabsTrigger value='block'>Block Biometric</TabsTrigger>
                    <TabsTrigger value='delete'>Delete Biometric</TabsTrigger>
                    <TabsTrigger value='link'>Link IDs {unlinked.length > 0 && `(${unlinked.length})`}</TabsTrigger>
                    <TabsTrigger value='commands'>View Commands</TabsTrigger>
                    {isOwner && <TabsTrigger value='machines'>Machine Setup</TabsTrigger>}
                </TabsList>

                <TabsContent value='enroll' className='space-y-4 pt-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Add a member to the machine</CardTitle>
                            <CardDescription>The software gives them a machine ID and sends their name to the machine. Then enroll the finger on the machine itself.</CardDescription>
                        </CardHeader>
                        <CardContent className='flex gap-2'>
                            <ItemSelector key={`m-${onMachine.length}`} data={notEnrolled} valueKey='id' labelKey='name' placeholder='Select member' searchPlaceholder='Search member' onSelect={setPickMember} />
                            <Button disabled={!pickMember} onClick={() => enrollMember(pickMember)}>Enroll</Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Add staff to the machine</CardTitle><CardDescription>Their punches then mark Staff Attendance.</CardDescription></CardHeader>
                        <CardContent className='flex gap-2'>
                            <ItemSelector key={`s-${linked.length}`} data={staff.filter((s) => s.active && !s.biometricId)} valueKey='id' labelKey='name' placeholder='Select staff' searchPlaceholder='Search staff' onSelect={setPickStaff} />
                            <Button disabled={!pickStaff} onClick={() => enrollStaff(pickStaff)}>Enroll</Button>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>Machine already has people on it?</CardTitle>
                            <CardDescription>Ask the machine for its list. Their names then appear under Link IDs, so you can match each one to a member once.</CardDescription>
                        </CardHeader>
                        <CardContent><Button variant='outline' onClick={() => run(() => call(RequestMachineUserList()), 'Asked the machine for its list')}>Get people from machine</Button></CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value='block' className='space-y-4 pt-4'>
                    <p className='text-muted-foreground text-sm'>
                        Blocking takes the person off the machine so it stops recognising them. Their fingerprint is deleted there, so they enroll again when unblocked.
                    </p>
                    {isOwner && (
                        <div className='flex items-center justify-between rounded-lg border p-4'>
                            <div>
                                <p className='font-medium'>Block automatically when membership ends</p>
                                <p className='text-muted-foreground text-sm'>Checked every few minutes. Renewing puts them back on the machine.</p>
                            </div>
                            <Switch checked={autoBlock} onCheckedChange={(v) => run(async () => { await call(SetAutoBlock(v)); setAutoBlockState(v) }, v ? 'Auto-block on' : 'Auto-block off')} />
                        </div>
                    )}
                    <Card>
                        <CardHeader><CardTitle>On the machine ({onMachine.length})</CardTitle></CardHeader>
                        <CardContent>
                            {onMachine.length === 0 && <p className='text-muted-foreground text-sm'>Nobody yet.</p>}
                            {onMachine.map((m) => (
                                <div key={m.id} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                                    <span className='font-medium'>{m.name}</span>
                                    <span className='text-muted-foreground text-sm'>ID {m.biometricId} · {m.status}</span>
                                    {m.state === 'expired' && <Badge variant='destructive'>Expired</Badge>}
                                    <Button size='sm' variant='outline' className='ml-auto' onClick={() => confirm(`Block ${m.name} on the machine?`) && run(() => call(RemoveMemberFromMachines(m.id)), 'Block sent to the machine')}>Block</Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Blocked ({blocked.length})</CardTitle></CardHeader>
                        <CardContent>
                            {blocked.length === 0 && <p className='text-muted-foreground text-sm'>Nobody is blocked.</p>}
                            {blocked.map((m) => (
                                <div key={m.id} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                                    <span className='font-medium'>{m.name}</span>
                                    <span className='text-muted-foreground text-sm'>ID {m.biometricId} · {m.blacklisted ? 'BlackList' : m.status}</span>
                                    {!m.blacklisted && <Button size='sm' className='ml-auto' onClick={() => enrollMember(m.id)}>Unblock</Button>}
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value='delete' className='space-y-4 pt-4'>
                    <p className='text-muted-foreground text-sm'>Deletes the person from the machine and frees their machine ID. Their past attendance stays.</p>
                    <Card>
                        <CardContent className='pt-6'>
                            {linked.length === 0 && <p className='text-muted-foreground text-sm'>Nobody has a machine ID.</p>}
                            {linked.map((p) => (
                                <div key={`${p.kind}-${p.id}`} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                                    <span className='font-medium'>{p.name}</span>
                                    <span className='text-muted-foreground text-sm'>ID {p.biometricId} · {p.kind}</span>
                                    <Button size='sm' variant='ghost' className='text-destructive ml-auto' onClick={() => confirm(`Delete ${p.name} from the machine?`) && run(() => call(DeleteFromMachines(p.id, p.kind)), 'Delete sent to the machine')}>Delete</Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value='link' className='space-y-4 pt-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle>Machine IDs without a person</CardTitle>
                            <CardDescription>These IDs have punched but are not linked to anyone. Pick who it is once; waiting punches are marked and future ones are automatic.</CardDescription>
                        </CardHeader>
                        <CardContent className='space-y-3'>
                            {unlinked.length === 0 && <p className='text-muted-foreground text-sm'>Nothing waiting.</p>}
                            {unlinked.map((id) => (
                                <div key={id.pin} className='space-y-2 rounded-lg border p-3'>
                                    <p className='font-medium'>ID {id.pin}{id.deviceName && <span className='text-muted-foreground font-normal'> · {id.deviceName} on the machine</span>}</p>
                                    <p className='text-muted-foreground text-sm'>{id.punches} punch{id.punches === 1 ? '' : 'es'} · last on {id.lastDate} at {id.lastTime.slice(0, 5)}</p>
                                    <div className='flex gap-2'>
                                        <ItemSelector data={people} valueKey='value' labelKey='label' placeholder='Select member or staff' searchPlaceholder='Search' onSelect={(v) => setChoices((c) => ({ ...c, [id.pin]: v }))} />
                                        <Button disabled={!choices[id.pin]} onClick={() => link(id.pin, choices[id.pin])}>Link</Button>
                                    </div>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>Linked ({linked.length})</CardTitle></CardHeader>
                        <CardContent>
                            {linked.map((p) => (
                                <div key={`${p.kind}-${p.id}`} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                                    <span>{p.name}</span>
                                    <span className='text-muted-foreground text-sm'>{p.kind}</span>
                                    <span className='text-muted-foreground ml-auto text-sm'>ID {p.biometricId}</span>
                                    <Button size='sm' variant='ghost' onClick={() => run(() => UnlinkBiometricId(p.id, p.kind), 'Unlinked')}>Unlink</Button>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                <TabsContent value='commands' className='pt-4'>
                    <Card>
                        <CardHeader>
                            <CardTitle>View Commands</CardTitle>
                            <CardDescription>Instructions sent to the machines. They are picked up within a minute while the machine is online.</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {commands.length === 0 && <p className='text-muted-foreground text-sm'>No commands yet.</p>}
                            {commands.map((c) => (
                                <div key={c.id} className='flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted'>
                                    <div>
                                        <p>{c.label}</p>
                                        <p className='text-muted-foreground text-xs'>{c.deviceSerial} · {formatDistanceToNow(c.createdAt, { addSuffix: true })}{c.returnCode && c.status === 'failed' ? ` · machine code ${c.returnCode}` : ''}</p>
                                    </div>
                                    <Badge className='ml-auto' variant={STATUS_BADGE[c.status]}>{STATUS_LABEL[c.status]}</Badge>
                                </div>
                            ))}
                        </CardContent>
                    </Card>
                </TabsContent>

                {isOwner && (
                    <TabsContent value='machines' className='space-y-4 pt-4'>
                        <Card>
                            <CardHeader>
                                <CardTitle>Connect the machine</CardTitle>
                                <CardDescription>On the machine open Menu → Comm. → Cloud Server Setting (also called ADMS) and enter:</CardDescription>
                            </CardHeader>
                            <CardContent className='space-y-4'>
                                <div className='bg-muted grid grid-cols-2 gap-y-1 rounded-md px-3 py-2 text-sm'>
                                    <span className='text-muted-foreground'>Server address</span><span className='font-mono'>{server.address ?? "this computer's IP address"}</span>
                                    <span className='text-muted-foreground'>Server port</span><span className='font-mono'>{server.port ?? port}</span>
                                    <span className='text-muted-foreground'>Enable domain name</span><span>{server.isDomain ? 'On' : 'Off'}</span>
                                    <span className='text-muted-foreground'>HTTPS</span><span>Off</span>
                                </div>
                                {unclaimed.length > 0 && <p className='text-sm'>Machines that just connected. Add yours only if the serial number matches the sticker on the back of your machine.</p>}
                                {unclaimed.map((m) => (
                                    <div key={m.serial} className='flex items-center gap-3 rounded-lg border border-blue-300 p-3'>
                                        <span className='font-mono'>{m.serial}</span>
                                        <span className='text-muted-foreground text-sm'>just connected</span>
                                        <Button size='sm' className='ml-auto' onClick={() => run(() => call(ClaimMachine(m.serial)), 'Machine added')}>This is my machine</Button>
                                    </div>
                                ))}
                                <div className='flex gap-2'>
                                    <Input placeholder='Machine serial number' value={newSerial} onChange={(e) => setNewSerial(e.target.value)} />
                                    <Button disabled={!newSerial.trim()} onClick={() => run(async () => { await call(RegisterDevice(newSerial)); setNewSerial('') }, 'Machine added. It connects by itself within a minute.')}>Add machine</Button>
                                </div>
                                <p className='text-muted-foreground text-sm'>The serial number is on the sticker at the back, or under Menu → System Info → Device Info.</p>
                                {devices.map((d) => (
                                    <div key={d.serial} className='flex items-center gap-3 rounded-lg border p-3'>
                                        <span className='font-mono'>{d.serial}</span>
                                        <Badge variant={d.lastSeenAt ? 'default' : 'secondary'}>{d.lastSeenAt ? 'Connected' : 'Not connected yet'}</Badge>
                                        <Button size='sm' variant='ghost' className='text-destructive ml-auto' onClick={() => confirm(`Remove machine ${d.serial}?`) && run(() => RemoveDevice(d.serial), 'Machine removed')}>Remove</Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>
                        <Card>
                            <CardHeader>
                                <CardTitle>No network? Import from a pen drive</CardTitle>
                                <CardDescription>On the machine use Menu → USB Manager → Download → Attendance Data, then choose the .dat file it saves.</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <input ref={fileInput} type='file' accept='.dat,.txt,.log' className='hidden' onChange={(e) => {
                                    const file = e.target.files?.[0]
                                    if (file) run(async () => {
                                        const r = await call(ImportPunchFile(await file.text()))
                                        toast.success(`${r.received} punches read, attendance marked for ${r.attendance}`)
                                    })
                                    if (fileInput.current) fileInput.current.value = ''
                                }} />
                                <Button variant='outline' onClick={() => fileInput.current?.click()}>Choose attendance file</Button>
                            </CardContent>
                        </Card>
                    </TabsContent>
                )}
            </Tabs>
        </div>
    )
}

export default function BiometricPage() {
    return <Suspense><BiometricManagement /></Suspense>
}
