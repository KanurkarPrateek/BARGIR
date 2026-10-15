'use client'
import { GetSalesWithPendingAmount } from '@/action/sales.action'
import { BackdateBanner } from '@/components/custom/backdate-banner'
import { RecordPaymentDialog } from '@/components/custom/record-payment-dialog'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { rupees } from '@/lib/membership'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

// BackDate Others: old payments against balances, plus shortcuts to the other
// BackDate forms.
const BackdatePage = () => {
    const [data, setData] = useState<any>()
    const load = async () => setData(await GetSalesWithPendingAmount())
    useEffect(() => { load() }, [])

    return (
        <div className='max-w-2xl w-full mx-auto space-y-6 p-4'>
            <div>
                <h1 className='text-xl font-semibold'>BackDate Management</h1>
                <p className='text-muted-foreground text-sm'>Enter old records when you start using this software. Nothing is sent to members for these.</p>
            </div>
            <Separator />
            <div className='grid gap-3 md:grid-cols-3'>
                <Link href='/members/new?backdate=1'><Button variant='outline' className='w-full'>BackDate Add Member</Button></Link>
                <Link href='/sales/new?backdate=1'><Button variant='outline' className='w-full'>BackDate Renew Subscription</Button></Link>
                <Link href='/enquiries/new?backdate=1'><Button variant='outline' className='w-full'>Back Date Add Enquiry</Button></Link>
            </div>
            <BackdateBanner what="payments received" />
            <Card>
                <CardHeader>
                    <CardTitle>BackDate Payment</CardTitle>
                    <CardDescription>Balances still open. Record money that was received earlier, with the real date.</CardDescription>
                </CardHeader>
                <CardContent>
                    {data?.sales?.length === 0 && <p className='text-muted-foreground text-sm'>No open balances.</p>}
                    {data?.sales?.map((sale: any) => (
                        <div key={sale.id} className='flex items-center gap-3 rounded-md p-2 hover:bg-muted'>
                            <div>
                                <p className='font-medium'>{sale.member_name}</p>
                                <p className='text-muted-foreground text-sm'>{sale.service_name} · {rupees(sale.due)} due</p>
                            </div>
                            <span className='ml-auto'><RecordPaymentDialog sale={sale} onSuccess={load} label='Record old payment' withDate /></span>
                        </div>
                    ))}
                </CardContent>
            </Card>
        </div>
    )
}

export default BackdatePage
