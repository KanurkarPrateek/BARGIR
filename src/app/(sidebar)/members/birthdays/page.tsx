'use client'
import { birthdayWish } from '@/lib/whatsapp/messages'
import { SendWhatsappButton } from '@/components/custom/send-whatsapp-button'
import { useGymName } from '@/hooks/use-gym-name'
import { GetEnquiryByFollowupDate } from '@/action/enquiries.action'
import { GetMembersWithDOB } from '@/action/member.action'
import { DataTable } from '@/components/custom/data-table'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
import Link from 'next/link'
import React, { useEffect, useState } from 'react'

type Props = {}

const columns = [
    {
        accessorKey: 'name',
        header: 'Name',
    },
    {
        accessorKey: 'phone',
        header: 'Phone',
    },
]
const page = (props: Props) => {
    const gymName = useGymName()
    const [memberList, setMemberList] = React.useState<any[]>([])
    const [SelectedMember, setSelectedMember] = React.useState<any>(null)
    const [message, setMessage] = React.useState<string>('')
    const [date, setDate] = useState(format(new Date, 'dd-MM-yyyy'))
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    useEffect(() => {
        
        setIsLoading(true)
        fetchData()
    }, [])
    useEffect(() => {
        setIsLoading(true)
        fetchData()
    }, [date])
    const handleMemberChange = (row: any) => {
        setSelectedMember(row)
        setMessage(birthdayWish(row.name, gymName))
    }

    async function fetchData() {
        const data = await GetMembersWithDOB(date)
        setMemberList(data)
        setIsLoading(false)
    }
  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Birthday Followups</h1>
        <DatePickerDemo defaultDate={date} onDateChange={(date) => setDate(date)}/>
      </div>
      <Separator />
      <Card>
                <CardHeader>
                    <CardTitle>Send message</CardTitle>
                    <CardDescription>Send message to selected member</CardDescription>
                </CardHeader>
                {
                    SelectedMember &&
                    <CardContent className='space-y-4'>
                        <p className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>{message}</p>
                        <SendWhatsappButton key={message} name={SelectedMember.name} phone={SelectedMember.phone} message={message} label='Send on WhatsApp' />
                    </CardContent>
                }

            </Card>
      <DataTable dataRows={memberList} isLoading={isLoading} columns={columns} onItemClick={handleMemberChange}   />
    </div>
  )
}

export default page