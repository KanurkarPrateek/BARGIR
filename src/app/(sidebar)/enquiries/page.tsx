'use client'
import { call } from '@/lib/action-result'
import { DeleteEnquiry, EnquiryResponse, GetAllEnquiry, UpdateEnquiry } from '@/action/enquiries.action'
import { GetSessionInfo } from '@/action/staff.action'
import { TrainerSelect } from '@/components/custom/trainer-select'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ENQUIRY_STATUSES, EnquiryStatus } from '@/lib/membership'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const FILTERS: { value: string; label: string; match: (enquiry: EnquiryResponse) => boolean }[] = [
    { value: 'pending', label: 'To follow up', match: (e) => e.status === 'open' || e.status === 'trial' },
    { value: 'joined', label: 'Joined', match: (e) => e.status === 'joined' },
    { value: 'lost', label: 'Lost', match: (e) => e.status === 'lost' },
    { value: 'all', label: 'All', match: () => true },
]

const EnquiryPage = () => {
    const [enquiries, setEnquiries] = useState<EnquiryResponse[]>([])
    const [filter, setFilter] = useState('pending')
    const [search, setSearch] = useState('')

    // Only the owner can delete; the front desk marks an enquiry as lost.
    const [isOwner, setIsOwner] = useState(false)

    const load = async () => setEnquiries(await GetAllEnquiry())
    useEffect(() => {
        load()
        GetSessionInfo().then((s) => setIsOwner(!!s && s.role !== 'staff'))
    }, [])

    const update = async (id: string, data: Parameters<typeof UpdateEnquiry>[1]) => {
        try {
            await call(UpdateEnquiry(id, data))
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const remove = async (enquiry: EnquiryResponse) => {
        if (!confirm(`Delete the enquiry from ${enquiry.name}?`)) return
        try {
            await call(DeleteEnquiry(enquiry.id))
            load()
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const activeFilter = FILTERS.find((f) => f.value === filter)!
    const term = search.toLowerCase()
    const visible = enquiries
        .filter(activeFilter.match)
        .filter((e) => !term || e.name.toLowerCase().includes(term) || e.phone.toString().includes(term))

    return (
        <div className='max-w-2xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <h1 className='text-xl font-semibold'>View Enquiry</h1>
                <Link href={'/enquiries/new'}>
                    <Button>Add Enquiry</Button>
                </Link>
            </div>
            <Separator />
            <Tabs value={filter} onValueChange={setFilter}>
                <TabsList>
                    {FILTERS.map((f) => (
                        <TabsTrigger key={f.value} value={f.value}>
                            {f.label} ({enquiries.filter(f.match).length})
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>
            <Input placeholder='Search by name or phone' value={search} onChange={(e) => setSearch(e.target.value)} />

            {visible.length === 0 && (
                <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No enquiries here.</p>
            )}

            {visible.map((enquiry) => (
                <div key={enquiry.id} className='space-y-3 rounded-lg border p-4'>
                    <div>
                        <p className='font-medium'>{enquiry.name} <span className='text-muted-foreground font-normal'>· {enquiry.phone.toString()}</span></p>
                        <p className='text-muted-foreground text-sm'>
                            <span className='capitalize'>{enquiry.type}</span>
                            {enquiry.followupDate && ` · follow up ${enquiry.followupDate}`}
                            {enquiry.message && ` · ${enquiry.message}`}
                        </p>
                    </div>
                    <div className='flex flex-wrap items-center gap-2'>
                        <Select value={enquiry.status} onValueChange={(status) => update(enquiry.id, { status: status as EnquiryStatus })}>
                            <SelectTrigger className='w-28'><SelectValue /></SelectTrigger>
                            <SelectContent>
                                {ENQUIRY_STATUSES.map((status) => (
                                    <SelectItem key={status.value} value={status.value}>{status.label}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <TrainerSelect
                            value={enquiry.trainer_id}
                            onChange={(trainerId) => update(enquiry.id, { trainer_id: trainerId })}
                            className='w-40'
                        />
                        <span className='ml-auto flex gap-2'>
                            {enquiry.status !== 'joined' && (
                                <Link href={`/members/new?enquiry=${enquiry.id}`}>
                                    <Button size='sm'>Make member</Button>
                                </Link>
                            )}
                            {isOwner && <Button size='sm' variant='ghost' className='text-destructive' onClick={() => remove(enquiry)}>Delete</Button>}
                        </span>
                    </div>
                </div>
            ))}
        </div>
    )
}

export default EnquiryPage
