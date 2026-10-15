'use client'
import { call } from '@/lib/action-result'
import { AssignPtTrainer, GetPtClients, GetTrainerDetail, PtClient, TrainerDetail } from '@/action/trainer.action'
import ItemSelector from '@/components/custom/item-selector'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import { MembershipBadge, membershipLabel } from '@/components/custom/membership-badge'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { rupees } from '@/lib/membership'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

const TrainerPage = ({ params }: { params: any }) => {
    const { trainer_id } = React.use(params) as { trainer_id: string }
    const [trainer, setTrainer] = useState<TrainerDetail | null>()

    const [clients, setClients] = useState<PtClient[]>([])
    const [picked, setPicked] = useState('')

    const load = async () => {
        setTrainer(await GetTrainerDetail(trainer_id))
        setClients(await GetPtClients())
    }
    useEffect(() => {
        load()
    }, [trainer_id])

    const add = async () => {
        try {
            await call(AssignPtTrainer(picked, trainer_id))
        } catch (error: any) {
            toast.error(error.message)
            return
        }
        toast.success('Member added')
        setPicked('')
        load()
    }

    const removeMember = async (memberId: string, name: string) => {
        if (!confirm(`Take ${name} off this trainer?`)) return
        try {
            await call(AssignPtTrainer(memberId, null))
        } catch (error: any) {
            toast.error(error.message)
            return
        }
        load()
    }

    // People with a running PT package who are not already with this trainer.
    const addable = clients
        .filter((client) => client.active && client.trainer_id !== trainer_id)
        .map((client) => ({
            ...client,
            label: `${client.name} · ${client.package} · ${client.trainer_name ? `with ${client.trainer_name}` : 'no trainer yet'}`,
        }))

    if (trainer === undefined) return <p className='text-muted-foreground p-4 text-center text-sm'>Loading…</p>
    if (trainer === null) return <p className='text-muted-foreground p-4 text-center text-sm'>Trainer not found.</p>

    const openEnquiries = trainer.enquiries.filter((e) => e.status === 'open' || e.status === 'trial')

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='flex items-center gap-2 text-xl font-semibold'>
                    {trainer.name}
                    {!trainer.active && <Badge variant='outline'>Inactive</Badge>}
                </h1>
                <p className='text-muted-foreground text-sm'>
                    {trainer.phone}
                    {trainer.specialization && ` · ${trainer.specialization}`}
                </p>
            </div>
            <Separator />
            <div className='grid grid-cols-3 gap-4'>
                <Card><CardHeader><CardDescription>Members</CardDescription><CardTitle className='text-2xl'>{trainer.memberCount}</CardTitle></CardHeader></Card>
                <Card><CardHeader><CardDescription>Open enquiries</CardDescription><CardTitle className='text-2xl'>{trainer.openEnquiryCount}</CardTitle></CardHeader></Card>
                <Card><CardHeader><CardDescription>Sold this month</CardDescription><CardTitle className='text-2xl'>{rupees(trainer.salesThisMonth)}</CardTitle></CardHeader></Card>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Members</CardTitle>
                    <CardDescription>Add anyone who has bought a personal training package.</CardDescription>
                </CardHeader>
                <CardContent className='space-y-3'>
                    {/* Keyed so the picker clears after a member is added. */}
                    <div className='flex items-center gap-2' key={trainer.members.length}>
                        <ItemSelector
                            data={addable}
                            valueKey='member_id'
                            labelKey='label'
                            placeholder={addable.length ? 'Select a PT member' : 'No PT members left to add'}
                            searchPlaceholder='Search PT members'
                            onSelect={setPicked}
                        />
                        <Button disabled={!picked} onClick={add}>Add</Button>
                    </div>
                    {trainer.members.length === 0 && <p className='text-muted-foreground text-sm'>No members assigned.</p>}
                    {trainer.members.map((member) => (
                        <div key={member.id} className='hover:bg-muted flex items-center gap-4 rounded-md p-2'>
                            <Link href={`/members/${member.id}`}>
                                <p className='hover:underline'>{member.name}</p>
                                <p className='text-muted-foreground text-sm'>
                                    {member.phone} · {member.ptPackage ? `${member.ptPackage} till ${member.ptEndDate}` : membershipLabel(member.membership)}
                                </p>
                            </Link>
                            <span className='ml-auto flex items-center gap-2'>
                                <MembershipBadge membership={member.membership} />
                                <Button size='sm' variant='ghost' className='text-destructive' onClick={() => removeMember(member.id, member.name)}>Remove</Button>
                            </span>
                        </div>
                    ))}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Enquiries to follow up</CardTitle>
                    <CardDescription>Change status or reassign from the Enquiries page.</CardDescription>
                </CardHeader>
                <CardContent>
                    {openEnquiries.length === 0 && <p className='text-muted-foreground text-sm'>Nothing open.</p>}
                    {openEnquiries.map((enquiry) => (
                        <div key={enquiry.id} className='flex items-center gap-4 rounded-md p-2'>
                            <div>
                                <p>{enquiry.name}</p>
                                <p className='text-muted-foreground text-sm'>
                                    {enquiry.phone}
                                    {enquiry.followupDate && ` · follow up ${enquiry.followupDate}`}
                                    {enquiry.message && ` · ${enquiry.message}`}
                                </p>
                            </div>
                            <Badge variant='secondary' className='ml-auto capitalize'>{enquiry.status}</Badge>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

export default TrainerPage
