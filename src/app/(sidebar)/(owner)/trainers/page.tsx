'use client'
import { call } from '@/lib/action-result'
import { AssignPtTrainer, DeleteTrainer, GetPtClients, GetTrainers, PtClient, SaveTrainer, TrainerInput, TrainerResponse } from '@/action/trainer.action'
import { TrainerSelect } from '@/components/custom/trainer-select'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { capitalizeWords } from '@/lib/utils'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const EMPTY: TrainerInput = { name: '', phone: '', specialization: '', active: true }

const TrainersPage = () => {
    const [trainers, setTrainers] = useState<TrainerResponse[]>([])
    const [editing, setEditing] = useState<TrainerInput | null>(null)

    const [clients, setClients] = useState<PtClient[]>([])
    const [onlyUnassigned, setOnlyUnassigned] = useState(false)

    const load = async () => {
        setTrainers(await GetTrainers())
        setClients(await GetPtClients())
    }

    const assign = async (client: PtClient, trainerId: string | null) => {
        try {
            await call(AssignPtTrainer(client.member_id, trainerId))
        } catch (error: any) {
            toast.error(error.message)
            return
        }
        toast.success(trainerId ? `${client.name} assigned` : `${client.name} has no trainer now`)
        load()
    }

    const unassignedCount = clients.filter((client) => client.active && !client.trainer_id).length
    const visibleClients = onlyUnassigned ? clients.filter((client) => !client.trainer_id) : clients
    useEffect(() => {
        load()
    }, [])

    const save = async () => {
        if (!editing) return
        try {
            await call(SaveTrainer(editing))
            toast.success('Trainer saved')
            setEditing(null)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const remove = async (trainer: TrainerResponse) => {
        if (!confirm(`Remove ${trainer.name}? Their members and enquiries will be left without a trainer.`)) return
        try {
            await call(DeleteTrainer(trainer.id))
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <div>
                    <h1 className='text-xl font-semibold'>Trainer Management</h1>
                    <p className='text-muted-foreground text-sm'>
                        Trainers get a WhatsApp message when a member or enquiry is assigned to them.
                    </p>
                </div>
                <Button onClick={() => setEditing(EMPTY)}>Add trainer</Button>
            </div>
            <Separator />

            <Tabs defaultValue='trainers'>
            <TabsList>
                <TabsTrigger value='trainers'>Trainers ({trainers.length})</TabsTrigger>
                <TabsTrigger value='clients'>
                    PT clients ({clients.length}){unassignedCount > 0 && ` · ${unassignedCount} need a trainer`}
                </TabsTrigger>
            </TabsList>

            <TabsContent value='clients' className='space-y-3 pt-4'>
                <div className='flex items-center justify-between gap-4'>
                    <p className='text-muted-foreground text-sm'>
                        Everyone who bought a personal training package, and who trains them.
                    </p>
                    <label className='flex shrink-0 items-center gap-2 text-sm'>
                        <Switch checked={onlyUnassigned} onCheckedChange={setOnlyUnassigned} />
                        No trainer yet
                    </label>
                </div>
                {visibleClients.length === 0 && (
                    <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>
                        {clients.length === 0
                            ? 'Nobody has bought a personal training package. Mark your PT plans under Plans & Services first.'
                            : 'Everyone has a trainer.'}
                    </p>
                )}
                {visibleClients.map((client) => (
                    <div key={client.member_id} className='flex flex-wrap items-center gap-4 rounded-lg border p-4'>
                        <div>
                            <Link href={`/members/${client.member_id}`} className='font-medium hover:underline'>{client.name}</Link>
                            <p className='text-muted-foreground text-sm'>
                                {client.phone} · {client.package} · {client.startDate} to {client.endDate}
                            </p>
                        </div>
                        <span className='ml-auto flex items-center gap-2'>
                            {!client.active && <Badge variant='destructive'>Package ended</Badge>}
                            <TrainerSelect value={client.trainer_id} onChange={(trainerId) => assign(client, trainerId)} className='w-40' />
                        </span>
                    </div>
                ))}
            </TabsContent>

            <TabsContent value='trainers' className='space-y-6 pt-4'>
            {trainers.length === 0 && (
                <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No trainers yet.</p>
            )}

            {trainers.map((trainer) => (
                <div key={trainer.id} className='space-y-2 rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-4'>
                        <div>
                            <Link href={`/trainers/${trainer.id}`} className='font-medium hover:underline'>
                                {trainer.name}
                            </Link>
                            <p className='text-muted-foreground text-sm'>
                                {trainer.phone}
                                {trainer.specialization && ` · ${trainer.specialization}`}
                            </p>
                        </div>
                        {!trainer.active && <Badge variant='outline'>Inactive</Badge>}
                    </div>
                    <p className='text-sm'>
                        {trainer.memberCount} member{trainer.memberCount === 1 ? '' : 's'} · {trainer.openEnquiryCount} open enquir{trainer.openEnquiryCount === 1 ? 'y' : 'ies'}
                    </p>
                    <div className='flex gap-2'>
                        <Link href={`/trainers/${trainer.id}`}>
                            <Button size='sm' variant='outline'>View</Button>
                        </Link>
                        <Button size='sm' variant='outline' onClick={() => setEditing(trainer)}>Edit</Button>
                        <Button size='sm' variant='ghost' className='text-destructive' onClick={() => remove(trainer)}>Remove</Button>
                    </div>
                </div>
            ))}
            </TabsContent>
            </Tabs>

            <Dialog open={!!editing} onOpenChange={(open) => !open && setEditing(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{editing?.id ? 'Edit trainer' : 'Add trainer'}</DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className='space-y-4'>
                            <div className='space-y-2'>
                                <Label>Name</Label>
                                <Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: capitalizeWords(e.target.value) })} />
                            </div>
                            <div className='space-y-2'>
                                <Label>WhatsApp number</Label>
                                <Input type='tel' placeholder='10 digit number' value={editing.phone} onChange={(e) => setEditing({ ...editing, phone: e.target.value })} />
                            </div>
                            <div className='space-y-2'>
                                <Label>Speciality</Label>
                                <Input placeholder='e.g. Weight loss, strength' value={editing.specialization ?? ''} onChange={(e) => setEditing({ ...editing, specialization: e.target.value })} />
                            </div>
                            <div className='flex items-center justify-between'>
                                <Label>Currently working here</Label>
                                <Switch checked={editing.active} onCheckedChange={(active) => setEditing({ ...editing, active })} />
                            </div>
                        </div>
                    )}
                    <DialogFooter>
                        <Button variant='outline' onClick={() => setEditing(null)}>Cancel</Button>
                        <Button onClick={save}>Save</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    )
}

export default TrainersPage
