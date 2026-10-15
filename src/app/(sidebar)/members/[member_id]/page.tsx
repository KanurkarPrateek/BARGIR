'use client'
import { call } from '@/lib/action-result'
import { DeletePayment } from '@/action/payment.action'
import { GetMemberProfile, MemberProfile, SetBlacklist } from '@/action/profile.action'
import { BatchRow, GetBatches, SetMemberBatch } from '@/action/batch.action'
import { AddMemberToMachines, RemoveMemberFromMachines } from '@/action/biometric.action'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { AssignPtTrainer } from '@/action/trainer.action'
import { ResendInvoice } from '@/action/sales.action'
import { describeDelivery } from '@/lib/invoice-delivery'
import { MembershipBadge } from '@/components/custom/membership-badge'
import { RecordPaymentDialog } from '@/components/custom/record-payment-dialog'
import { TrainerSelect } from '@/components/custom/trainer-select'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { paymentModeLabel, rupees } from '@/lib/membership'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const MemberProfilePage = ({ params }: { params: any }) => {
    const { member_id } = React.use(params) as { member_id: string }
    const [member, setMember] = useState<MemberProfile | null>()

    const load = async () => setMember(await GetMemberProfile(member_id))
    const [batches, setBatches] = useState<BatchRow[]>([])
    useEffect(() => { GetBatches().then(setBatches) }, [])
    useEffect(() => {
        load()
    }, [member_id])

    if (member === undefined) return <p className='text-muted-foreground p-4 text-center text-sm'>Loading…</p>
    if (member === null) return <p className='text-muted-foreground p-4 text-center text-sm'>Member not found.</p>

    const { membership } = member
    // Renewing usually means the same plan again.
    const renewUrl = `/sales/new?member=${member.id}${member.sales[0] ? `&service=${member.sales[0].service_id}` : ''}`

    const changeTrainer = async (trainerId: string | null) => {
        try {
            await call(AssignPtTrainer(member.id, trainerId))
        } catch (error: any) {
            toast.error(error.message)
            return
        }
        toast.success(trainerId ? 'Trainer assigned' : 'Trainer removed')
        load()
    }

    const sendInvoice = async (saleId: string) => {
        try {
            toast.success(describeDelivery(await call(ResendInvoice(saleId))))
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const run = async (fn: () => Promise<unknown>, done: string) => {
        try {
            await fn()
            toast.success(done)
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }
    const changeBatch = (batchId: string | null) => run(() => call(SetMemberBatch(member.id, batchId)), 'Batch updated')
    const addToMachine = async () => {
        try {
            const pin = await call(AddMemberToMachines(member.id))
            toast.success(`Sent to the machine as ID ${pin}`, { description: `On the machine open User Management, find ID ${pin} and enroll the fingerprint.`, duration: 10000 })
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }
    const removeFromMachine = () => {
        if (!confirm(`Remove ${member.name} from the biometric machine? Their fingerprint is deleted there and must be enrolled again later.`)) return
        run(() => call(RemoveMemberFromMachines(member.id)), 'Removal sent to the machine')
    }
    const toggleBlacklist = () => {
        if (member.blacklisted) return run(() => call(SetBlacklist(member.id, false)), 'Removed from BlackList')
        const reason = prompt(`Why is ${member.name} being blacklisted? (shown at check-in)`)
        if (reason === null) return
        run(() => call(SetBlacklist(member.id, true, reason)), 'Added to BlackList')
    }

    const removePayment = async (id: string, amount: number) => {
        if (!confirm(`Delete this payment of ${rupees(amount)}? The amount goes back to due.`)) return
        await DeletePayment(id)
        load()
    }

    return (
        <div className='max-w-2xl w-full mx-auto space-y-6 p-4'>
            <div className='flex flex-wrap items-start justify-between gap-4'>
                <div>
                    <h1 className='flex items-center gap-2 text-2xl font-semibold'>
                        {member.name}
                        <MembershipBadge membership={membership} />
                    </h1>
                    <p className='text-muted-foreground text-sm'>
                        {member.memberCode} · {member.phone} · joined {member.DOJ}
                    </p>
                </div>
                <div className='flex gap-2'>
                    <Link href={renewUrl}>
                        <Button>{member.sales.length ? 'Renew / new sale' : 'Sell a plan'}</Button>
                    </Link>
                    <Link href={`/members/${member.id}/edit`}>
                        <Button variant='outline'>Edit details</Button>
                    </Link>
                    <Button variant='ghost' className={member.blacklisted ? '' : 'text-destructive'} onClick={toggleBlacklist}>
                        {member.blacklisted ? 'Remove from BlackList' : 'BlackList'}
                    </Button>
                </div>
            </div>
            <Separator />

            <div className='grid grid-cols-2 gap-4 md:grid-cols-4'>
                <Card>
                    <CardHeader>
                        <CardDescription>Membership</CardDescription>
                        <CardTitle className='text-lg'>
                            {membership.state === 'none' && 'No plan'}
                            {membership.state === 'expired' && `Ended ${-membership.daysLeft!}d ago`}
                            {(membership.state === 'active' || membership.state === 'expiring') && `${membership.daysLeft} days left`}
                        </CardTitle>
                        {membership.endDate && <CardDescription>till {membership.endDate}</CardDescription>}
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Due</CardDescription>
                        <CardTitle className={`text-lg ${member.totalDue > 0 ? 'text-destructive' : ''}`}>{rupees(member.totalDue)}</CardTitle>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Paid so far</CardDescription>
                        <CardTitle className='text-lg'>{rupees(member.totalPaid)}</CardTitle>
                        <CardDescription>of {rupees(member.totalBilled)} billed</CardDescription>
                    </CardHeader>
                </Card>
                <Card>
                    <CardHeader>
                        <CardDescription>Visits</CardDescription>
                        <CardTitle className='text-lg'>{member.attendanceCount}</CardTitle>
                        {member.recentAttendance[0] && <CardDescription>last {member.recentAttendance[0].date}</CardDescription>}
                    </CardHeader>
                </Card>
            </div>

            <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
                <div>
                    <p className='font-medium'>Personal trainer</p>
                    <p className='text-muted-foreground text-sm'>The trainer is told on WhatsApp when assigned.</p>
                </div>
                <TrainerSelect value={member.trainer?.id} onChange={changeTrainer} className='w-48' />
            </div>

            <div className='grid gap-4 md:grid-cols-2'>
                <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
                    <div>
                        <p className='font-medium'>Batch</p>
                        <p className='text-muted-foreground text-sm'>Time slot they usually come in.</p>
                    </div>
                    <Select value={member.batch_id ?? 'none'} onValueChange={(v) => changeBatch(v === 'none' ? null : v)}>
                        <SelectTrigger className='w-44'><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value='none'>No batch</SelectItem>
                            {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.startTime})</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className='flex items-center justify-between gap-4 rounded-lg border p-4'>
                    <div>
                        <p className='font-medium'>Biometric</p>
                        <p className='text-muted-foreground text-sm'>
                            {member.blacklisted ? 'Blacklisted: kept off the machine.'
                                : !member.biometricId ? 'Not on the machine yet.'
                                : member.machineBlocked ? `Removed from the machine (ID ${member.biometricId}).`
                                : `On the machine as ID ${member.biometricId}.`}
                        </p>
                    </div>
                    {!member.blacklisted && (member.biometricId && !member.machineBlocked
                        ? <Button size='sm' variant='outline' onClick={removeFromMachine}>Block</Button>
                        : <Button size='sm' onClick={addToMachine}>{member.biometricId ? 'Unblock' : 'Enroll'}</Button>)}
                </div>
            </div>

            {member.blacklisted && (
                <div className='rounded-lg border border-red-300 bg-red-50 p-4 text-sm text-red-800 dark:bg-red-950 dark:text-red-200'>
                    <strong>BlackList Member.</strong> {member.blacklistReason ?? 'No reason given.'} Check-in is refused.
                </div>
            )}

            <Tabs defaultValue='plans'>
                <TabsList>
                    <TabsTrigger value='plans'>Plans ({member.sales.length})</TabsTrigger>
                    <TabsTrigger value='payments'>Payments ({member.payments.length})</TabsTrigger>
                    <TabsTrigger value='attendance'>Attendance</TabsTrigger>
                    <TabsTrigger value='details'>Details</TabsTrigger>
                </TabsList>

                <TabsContent value='plans' className='space-y-3 pt-4'>
                    {member.sales.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No plan sold yet.</p>}
                    {member.sales.map((sale) => (
                        <div key={sale.id} className='space-y-2 rounded-lg border p-4'>
                            <div className='flex items-start justify-between gap-4'>
                                <div>
                                    <p className='font-medium'>{sale.service_name}</p>
                                    <p className='text-muted-foreground text-sm'>
                                        {sale.startDate} to {sale.endDate}
                                        {sale.trainer_name && ` · with ${sale.trainer_name}`}
                                    </p>
                                </div>
                                <p className='text-right text-sm'>
                                    {rupees(sale.amount - sale.discount)}
                                    {sale.discount > 0 && <span className='text-muted-foreground block'>after {rupees(sale.discount)} off</span>}
                                </p>
                            </div>
                            <div className='flex items-center gap-2'>
                                <p className='text-sm'>
                                    Paid {rupees(sale.paid)}
                                    {sale.due > 0 && <span className='text-destructive'> · {rupees(sale.due)} due</span>}
                                </p>
                                <span className='ml-auto flex gap-2'>
                                    {sale.due > 0 && <RecordPaymentDialog sale={{ ...sale, member_name: member.name }} onSuccess={load} />}
                                    <Link href={`/invoices/${sale.id}`} target='_blank'>
                                        <Button size='sm' variant='ghost'>Invoice</Button>
                                    </Link>
                                    <Button size='sm' variant='ghost' onClick={() => sendInvoice(sale.id)}>Send invoice</Button>
                                </span>
                            </div>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value='payments' className='pt-4'>
                    {member.payments.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No payments yet.</p>}
                    {member.payments.map((payment) => (
                        <div key={payment.id} className='hover:bg-muted flex items-center gap-4 rounded-md p-2'>
                            <div>
                                <p>{rupees(payment.amount)} <span className='text-muted-foreground text-sm'>· {paymentModeLabel(payment.mode)}</span></p>
                                <p className='text-muted-foreground text-sm'>
                                    {payment.date} · {payment.service_name}
                                    {payment.note && ` · ${payment.note}`}
                                </p>
                            </div>
                            <Button size='sm' variant='ghost' className='text-destructive ml-auto' onClick={() => removePayment(payment.id, payment.amount)}>Delete</Button>
                        </div>
                    ))}
                </TabsContent>

                <TabsContent value='attendance' className='pt-4'>
                    {member.recentAttendance.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No visits yet.</p>}
                    {member.recentAttendance.map((visit) => (
                        <div key={visit.id} className='hover:bg-muted flex gap-4 rounded-md p-2'>
                            <p>{visit.date}</p>
                            <p className='text-muted-foreground ml-auto'>{visit.time.slice(0, 5)}</p>
                        </div>
                    ))}
                    {member.attendanceCount > member.recentAttendance.length && (
                        <p className='text-muted-foreground p-2 text-sm'>Showing the latest {member.recentAttendance.length} of {member.attendanceCount} visits.</p>
                    )}
                </TabsContent>

                <TabsContent value='details' className='pt-4'>
                    <div className='grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border p-4 text-sm'>
                        <span className='text-muted-foreground'>Phone</span><span>{member.phone}</span>
                        <span className='text-muted-foreground'>Email</span><span>{member.email || '-'}</span>
                        <span className='text-muted-foreground'>Gender</span><span className='capitalize'>{member.gender}</span>
                        <span className='text-muted-foreground'>Date of birth</span><span>{member.DOB}</span>
                        <span className='text-muted-foreground'>Address</span><span>{member.address || '-'}</span>
                        <span className='text-muted-foreground'>Biometric ID</span><span>{member.biometricId || 'Not linked'}</span>
                    </div>
                </TabsContent>
            </Tabs>
        </div>
    )
}

export default MemberProfilePage
