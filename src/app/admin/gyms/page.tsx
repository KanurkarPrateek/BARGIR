'use client'
import { call } from '@/lib/action-result'
import { CreateGym, EnterGym, GymInput, GymResponse, ListGyms, ResetOwnerPassword, SetGymActive } from '@/action/gym.action'
import { SignOut } from '@/action/staff.action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { capitalizeWords } from '@/lib/utils'
import { format } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const EMPTY: GymInput = { name: '', ownerName: '', ownerPhone: '', password: '' }

const GymsPage = () => {
    const [gyms, setGyms] = useState<GymResponse[]>([])
    const [creating, setCreating] = useState<GymInput | null>(null)

    const load = async () => setGyms(await ListGyms())
    useEffect(() => {
        load()
    }, [])

    const create = async () => {
        if (!creating) return
        try {
            await call(CreateGym(creating))
            toast.success('Gym created. Share the phone number and password with the owner.')
            setCreating(null)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const open = async (gym: GymResponse) => {
        try {
            await call(EnterGym(gym.id))
        } catch (error: any) {
            toast.error(error.message)
            return
        }
        window.location.href = '/dashboard'
    }

    const resetPassword = async (gym: GymResponse) => {
        const password = prompt(`New password for ${gym.ownerName} (at least 8 characters)`)
        if (!password) return
        try {
            await call(ResetOwnerPassword(gym.id, password))
            toast.success('Password changed')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const signOut = async () => {
        await SignOut()
        window.location.href = '/signin'
    }

    return (
        <div className='max-w-2xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-xl font-semibold'>Gyms</h1>
                    <p className='text-muted-foreground text-sm'>Each gym has its own login and sees only its own data. Gyms can also sign themselves up at <span className='font-mono'>/signup</span>.</p>
                </div>
                <div className='flex gap-2'>
                    <Button variant='outline' onClick={signOut}>Sign out</Button>
                    <Button onClick={() => setCreating(EMPTY)}>Add gym</Button>
                </div>
            </div>
            <Separator />

            {gyms.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No gyms yet.</p>}

            {gyms.map((gym) => (
                <div key={gym.id} className='space-y-2 rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-4'>
                        <div>
                            <p className='font-medium'>{gym.name}</p>
                            <p className='text-muted-foreground text-sm'>
                                {gym.ownerName} · {gym.ownerPhone} · since {format(gym.createdAt, 'dd MMM yyyy')}
                            </p>
                        </div>
                        {!gym.active && <Badge variant='destructive'>Switched off</Badge>}
                    </div>
                    <p className='text-sm'>
                        {gym.members} member{gym.members === 1 ? '' : 's'} · {gym.machines} biometric machine{gym.machines === 1 ? '' : 's'}
                    </p>
                    <div className='flex flex-wrap gap-2'>
                        <Button size='sm' onClick={() => open(gym)}>Open</Button>
                        <Button size='sm' variant='outline' onClick={() => resetPassword(gym)}>Reset password</Button>
                        <Button size='sm' variant='ghost' onClick={() => SetGymActive(gym.id, !gym.active).then(load)}>
                            {gym.active ? 'Switch off' : 'Switch on'}
                        </Button>
                    </div>
                </div>
            ))}

            <Dialog open={!!creating} onOpenChange={(isOpen) => !isOpen && setCreating(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>Add gym</DialogTitle>
                        <DialogDescription>The owner signs in with this phone number and password.</DialogDescription>
                    </DialogHeader>
                    {creating && (
                        <div className='space-y-4'>
                            <div className='space-y-2'>
                                <Label>Gym name</Label>
                                <Input value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} />
                            </div>
                            <div className='space-y-2'>
                                <Label>Owner name</Label>
                                <Input value={creating.ownerName} onChange={(e) => setCreating({ ...creating, ownerName: capitalizeWords(e.target.value) })} />
                            </div>
                            <div className='space-y-2'>
                                <Label>Owner phone</Label>
                                <Input type='tel' placeholder='10 digit mobile number' value={creating.ownerPhone} onChange={(e) => setCreating({ ...creating, ownerPhone: e.target.value })} />
                            </div>
                            <div className='space-y-2'>
                                <Label>Password</Label>
                                <Input placeholder='At least 8 characters' value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setCreating(null)}>Cancel</Button>
                        <Button onClick={create}>Create gym</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default GymsPage
