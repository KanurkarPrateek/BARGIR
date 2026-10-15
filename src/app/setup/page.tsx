'use client'
import { AddStarterBatches, AddStarterPackages, ClaimMachine, FinishSetup, GetSetupState, GetUnclaimedMachines, SetupState, StarterPackage } from '@/action/onboarding.action'
import { GetGymProfile, GymProfile, UpdateGymProfile } from '@/action/staff.action'
import { GetServerAddress, RegisterDevice, ServerAddress } from '@/action/biometric.action'
import ConnectionCard from '@/app/(sidebar)/(owner)/whatsapp/_components/connection-card'
import { MemberImport } from '@/components/onboarding/member-import'
import { call } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Switch } from '@/components/ui/switch'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { formatDistanceToNow } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const STEPS = ['Your gym', 'Packages', 'Batches', 'Members', 'WhatsApp', 'Biometric']

const STARTER_PACKAGES: (StarterPackage & { on: boolean })[] = [
    { name: 'Monthly', price: 1000, duration: 1, isPersonalTraining: false, on: true },
    { name: 'Quarterly', price: 2700, duration: 3, isPersonalTraining: false, on: true },
    { name: 'Half Yearly', price: 5000, duration: 6, isPersonalTraining: false, on: true },
    { name: 'Yearly', price: 9000, duration: 12, isPersonalTraining: false, on: true },
    { name: 'Personal Training (Monthly)', price: 5000, duration: 1, isPersonalTraining: true, on: false },
]
const STARTER_BATCHES = [
    { name: 'Morning', startTime: '06:00', endTime: '09:00', on: true },
    { name: 'Afternoon', startTime: '12:00', endTime: '15:00', on: false },
    { name: 'Evening', startTime: '17:00', endTime: '21:00', on: true },
]

// The first thing a new gym owner sees: six short steps, each skippable, that
// leave the gym ready to use.
export default function SetupWizard() {
    const [step, setStep] = useState(0)
    const [state, setState] = useState<SetupState | null>(null)
    const [profile, setProfile] = useState<GymProfile | null>(null)
    const [packages, setPackages] = useState(STARTER_PACKAGES)
    const [batches, setBatches] = useState(STARTER_BATCHES)
    const [server, setServer] = useState<ServerAddress | null>(null)
    const [machines, setMachines] = useState<{ serial: string; lastSeenAt: Date | null }[]>([])
    const [serial, setSerial] = useState('')
    const [busy, setBusy] = useState(false)

    const refresh = async () => setState(await GetSetupState())
    useEffect(() => {
        refresh()
        GetGymProfile().then(setProfile)
        GetServerAddress().then(setServer)
    }, [])
    // While on the biometric step, look for a machine that has just connected.
    useEffect(() => {
        if (step !== 5) return
        const look = () => GetUnclaimedMachines().then(setMachines)
        look()
        const timer = setInterval(look, 5000)
        return () => clearInterval(timer)
    }, [step])

    const next = () => { setStep((s) => Math.min(s + 1, STEPS.length - 1)); refresh() }
    const act = async (fn: () => Promise<unknown>, done: string, advance = true) => {
        setBusy(true)
        try {
            await fn()
            if (done) toast.success(done)
            if (advance) next()
        } catch (error: any) { toast.error(error.message) }
        setBusy(false)
    }
    const finish = () => act(async () => { await call(FinishSetup()); window.location.href = '/dashboard' }, '', false)

    return (
        <div className='mx-auto max-w-2xl space-y-6 p-4 py-10'>
            <div className='space-y-2'>
                <h1 className='text-2xl font-semibold'>Set up {state?.gymName ?? 'your gym'}</h1>
                <p className='text-muted-foreground text-sm'>Step {step + 1} of {STEPS.length}: {STEPS[step]}. You can skip anything and come back later.</p>
                <Progress value={((step + 1) / STEPS.length) * 100} />
                <div className='flex flex-wrap gap-1'>
                    {STEPS.map((s, i) => (
                        <button key={s} onClick={() => setStep(i)} className={`rounded px-2 py-1 text-xs ${i === step ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>{i + 1}. {s}</button>
                    ))}
                </div>
            </div>

            {step === 0 && profile && (
                <Card>
                    <CardHeader><CardTitle>Your gym</CardTitle><CardDescription>Printed on invoices and used in WhatsApp messages. Add your logo later in Gym Settings.</CardDescription></CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='space-y-2'><Label>Gym name</Label><Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
                        <div className='space-y-2'><Label>Address</Label><Input placeholder='Shop no., street, city' value={profile.address} onChange={(e) => setProfile({ ...profile, address: e.target.value })} /></div>
                        <div className='space-y-2'><Label>Contact number</Label><Input type='tel' value={profile.phone} onChange={(e) => setProfile({ ...profile, phone: e.target.value })} /></div>
                        <div className='space-y-2'><Label>GST number <span className='text-muted-foreground font-normal'>(optional)</span></Label><Input value={profile.gstin} onChange={(e) => setProfile({ ...profile, gstin: e.target.value })} /></div>
                        <Button disabled={busy} onClick={() => act(() => call(UpdateGymProfile(profile)), 'Saved')}>Save and continue</Button>
                    </CardContent>
                </Card>
            )}

            {step === 1 && (
                <Card>
                    <CardHeader><CardTitle>What do you sell?</CardTitle><CardDescription>Tick your packages and set your prices. You can change or add more later.</CardDescription></CardHeader>
                    <CardContent className='space-y-3'>
                        {state && state.packages > 0 && <p className='text-sm'>You already have {state.packages} package{state.packages === 1 ? '' : 's'}.</p>}
                        {packages.map((p, i) => (
                            <div key={p.name} className='flex items-center gap-3'>
                                <Switch checked={p.on} onCheckedChange={(v: boolean) => setPackages(packages.map((x, j) => j === i ? { ...x, on: !!v } : x))} />
                                <span className='w-52 text-sm'>{p.name}</span>
                                <span className='text-muted-foreground text-sm'>₹</span>
                                <Input type='number' className='w-28' value={p.price} onChange={(e) => setPackages(packages.map((x, j) => j === i ? { ...x, price: Number(e.target.value) } : x))} />
                                <span className='text-muted-foreground text-sm'>{p.duration} month{p.duration > 1 ? 's' : ''}</span>
                            </div>
                        ))}
                        <div className='flex gap-2 pt-2'>
                            <Button disabled={busy || !packages.some((p) => p.on)} onClick={() => act(async () => { const n = await call(AddStarterPackages(packages.filter((p) => p.on))); toast.success(`${n} package${n === 1 ? '' : 's'} added`) }, '')}>Add packages and continue</Button>
                            <Button variant='ghost' onClick={next}>Skip</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 2 && (
                <Card>
                    <CardHeader><CardTitle>Batches</CardTitle><CardDescription>Time slots members come in. Optional; helps you see who comes when.</CardDescription></CardHeader>
                    <CardContent className='space-y-3'>
                        {batches.map((b, i) => (
                            <div key={b.name} className='flex items-center gap-3'>
                                <Switch checked={b.on} onCheckedChange={(v: boolean) => setBatches(batches.map((x, j) => j === i ? { ...x, on: !!v } : x))} />
                                <span className='w-28 text-sm'>{b.name}</span>
                                <Input type='time' className='w-32' value={b.startTime} onChange={(e) => setBatches(batches.map((x, j) => j === i ? { ...x, startTime: e.target.value } : x))} />
                                <span className='text-sm'>to</span>
                                <Input type='time' className='w-32' value={b.endTime} onChange={(e) => setBatches(batches.map((x, j) => j === i ? { ...x, endTime: e.target.value } : x))} />
                            </div>
                        ))}
                        <div className='flex gap-2 pt-2'>
                            <Button disabled={busy || !batches.some((b) => b.on)} onClick={() => act(() => call(AddStarterBatches(batches.filter((b) => b.on))), 'Batches added')}>Add batches and continue</Button>
                            <Button variant='ghost' onClick={next}>Skip</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 3 && (
                <Card>
                    <CardHeader><CardTitle>Bring in your members</CardTitle><CardDescription>Upload the member list you already keep in Excel. Running memberships come in too, and nobody is messaged.</CardDescription></CardHeader>
                    <CardContent className='space-y-4'>
                        <MemberImport onDone={refresh} />
                        <div className='flex gap-2'>
                            <Button variant={state?.members ? 'default' : 'ghost'} onClick={next}>{state?.members ? `Continue with ${state.members} members` : 'Skip, I will add members later'}</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            {step === 4 && (
                <div className='space-y-3'>
                    <ConnectionCard />
                    <p className='text-muted-foreground text-sm'>Once linked, welcome messages, invoices, receipts and renewal reminders go out by themselves. You can change every message under WhatsApp Management.</p>
                    <Button variant='ghost' onClick={next}>Continue</Button>
                </div>
            )}

            {step === 5 && (
                <Card>
                    <CardHeader><CardTitle>Biometric machine</CardTitle><CardDescription>Optional. On the machine open Menu → Comm. → Cloud Server Setting and enter:</CardDescription></CardHeader>
                    <CardContent className='space-y-4'>
                        <div className='bg-muted grid grid-cols-2 gap-y-1 rounded-md px-3 py-2 text-sm'>
                            <span className='text-muted-foreground'>Server address</span><span className='font-mono'>{server?.address ?? (typeof window !== 'undefined' ? window.location.hostname : '')}</span>
                            <span className='text-muted-foreground'>Server port</span><span className='font-mono'>{server?.port ?? (typeof window !== 'undefined' ? window.location.port || '443' : '')}</span>
                            <span className='text-muted-foreground'>Enable domain name</span><span>{server?.isDomain ? 'On' : 'Off'}</span>
                        </div>
                        <p className='text-sm font-medium'>{machines.length ? 'Machines that just connected:' : 'Waiting for your machine to connect… (checks every 5 seconds)'}</p>
                        {machines.length > 0 && <p className='text-muted-foreground text-sm'>Pick the one whose serial number matches the sticker on the back of your machine (or Menu → System Info → Device Info).</p>}
                        {machines.map((m) => (
                            <div key={m.serial} className='flex items-center gap-3 rounded-lg border p-3'>
                                <span className='font-mono'>{m.serial}</span>
                                <span className='text-muted-foreground text-sm'>{m.lastSeenAt ? formatDistanceToNow(m.lastSeenAt, { addSuffix: true }) : ''}</span>
                                <Button size='sm' className='ml-auto' disabled={busy} onClick={() => act(() => call(ClaimMachine(m.serial)), 'Machine added', false).then(refresh)}>This is my machine</Button>
                            </div>
                        ))}
                        {state && state.machines > 0 && <p className='text-sm text-green-700 dark:text-green-400'>✓ {state.machines} machine{state.machines === 1 ? '' : 's'} added.</p>}
                        <div className='flex gap-2'>
                            <Input placeholder='Or type the serial number' value={serial} onChange={(e) => setSerial(e.target.value)} />
                            <Button variant='outline' disabled={!serial.trim() || busy} onClick={() => act(async () => { await call(RegisterDevice(serial)); setSerial('') }, 'Machine added', false).then(refresh)}>Add</Button>
                        </div>
                        <Button onClick={finish} disabled={busy}>{state?.machines ? 'Finish setup' : "I don't have a machine — finish setup"}</Button>
                    </CardContent>
                </Card>
            )}
        </div>
    )
}
