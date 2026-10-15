'use client'
import { renewalReminder } from '@/lib/whatsapp/messages'
import { differenceInCalendarDays, parse, startOfDay } from 'date-fns'
import { SendWhatsappButton } from '@/components/custom/send-whatsapp-button'
import { useGymName } from '@/hooks/use-gym-name'
import { GetEnquiryByFollowupDate } from '@/action/enquiries.action'
import { getAllExpiringSalesInXDays, GetSalesEndingInXdays } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useLoading } from '@/hooks/use-loading'
import { format } from 'date-fns'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Props = {}

const columns = [
    {
        accessorKey: 'member_name',
        header: 'Name',
    },
    {
        accessorKey: 'endDate',
        header: 'End',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'startDate',
        header: 'Start',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'member_phone',
        header: 'Phone',
    },
    {
        accessorKey: 'service_name',
        header: 'Service',
    },
]
const page = (props: Props) => {
    const gymName = useGymName()
    const [salesList, setSalesList] = React.useState<any[]>([])
    const [days, setDays] = useState(0)
    const [SelectedSale, setSelectedSale] = useState<any>(null)
    const [message, setMessage] = useState('')
    const { showLoading, hideLoading, isLoading } = useLoading()
    useEffect(() => {
        showLoading()
        fetchData()
    }, [])
    useEffect(() => {
        showLoading()
        fetchData()
    }, [days])

    async function fetchData() {
        if (days === -1) {
            const data = await GetSalesEndingInXdays(-1)
            setSalesList(data)
            hideLoading()
            return
        } else {
            const data = await getAllExpiringSalesInXDays(days)
            setSalesList(data)
            hideLoading()
            return
        }
        // console.log(await GetSalesEndingInXdays(-1))
    }

    const handleSaleSelected = (row: any) => {
        setSelectedSale(row);
        const days = differenceInCalendarDays(parse(row.endDate, 'dd-MM-yyyy', new Date()), startOfDay(new Date()))
        setMessage(renewalReminder(row.member_name, row.service_name, row.endDate, days, gymName))
    }

    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <h1 className='text-xl font-semibold'>Renewal Follow-ups</h1>
            </div>
            <Separator />
            <Card>
                <CardHeader>
                    <CardTitle>Send message</CardTitle>
                    <CardDescription>Send message to selected member</CardDescription>
                </CardHeader>
                {
                    SelectedSale &&
                    <CardContent className='space-y-4'>
                        <p className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>{message}</p>
                        <SendWhatsappButton key={message} name={SelectedSale.member_name} phone={SelectedSale.member_phone} message={message} label='Send on WhatsApp' />
                    </CardContent>
                }

            </Card>
            <Tabs onValueChange={(e) => setDays(parseInt(e))} defaultValue='0'>
                <TabsList >
                    <TabsTrigger value='0'>Today</TabsTrigger>
                    <TabsTrigger value='1'>Tomorrow</TabsTrigger>
                    <TabsTrigger value='5'>5 days</TabsTrigger>
                    <TabsTrigger value='7'>7 days</TabsTrigger>
                    <TabsTrigger value='-1'>Expired</TabsTrigger>
                </TabsList>
            </Tabs>
            <DataTable dataRows={salesList} isLoading={isLoading} columns={columns} onItemClick={handleSaleSelected} />
        </div>
    )
}

export default page
