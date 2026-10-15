'use client'
import { GetEnquiryByFollowupDate } from '@/action/enquiries.action'
import { DataTable } from '@/components/custom/data-table'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Separator } from '@/components/ui/separator'
import { format } from 'date-fns'
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
    {
        accessorKey: 'followupDate',
        header: 'Follow Up',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'type',
        header: 'Type',
        cellClassName: 'capitalize',
    },
    {
        accessorKey: 'message',
        header: 'Message',
    }
]
const page = (props: Props) => {
    const [memberList, setMemberList] = React.useState<any[]>([])
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

    async function fetchData() {
        const data = await GetEnquiryByFollowupDate(date)
        setMemberList(data)
        setIsLoading(false)
    }
  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>Enquiry Followups</h1>
        <DatePickerDemo defaultDate={date} onDateChange={(date) => setDate(date)}/>
      </div>
      <Separator />
      <DataTable dataRows={memberList} isLoading={isLoading} columns={columns}  />
    </div>
  )
}

export default page