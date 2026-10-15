'use client'
import { AddAttendance, GetAttendanceByDate } from '@/action/attendance.action'
import { GetAllMembers } from '@/action/member.action'
import { DatePickerDemo } from '@/components/custom/date-picker'
import ItemSelector from '@/components/custom/item-selector'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { format, set } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Props = {}

const page = (props: Props) => {
    const {showLoading, hideLoading} = useLoading()
    const [memberList, setMemberList] = React.useState<any[]>([])
    const [isLoading, setIsLoading] = React.useState<boolean>(false)
    const [selectedMember, setSelectedMember] = React.useState<string>()
    const [date, setDate] = useState(format(new Date, 'dd-MM-yyyy'))
    const [attendanceList, setAttendanceList] = React.useState<any[]>([])
    const [refresh, setRefresh] = React.useState<boolean>(false)
    useEffect(() => {
        // async function fetchData() {
        //     const data = await GetAllMembers()
        //     setMemberList(data)
        // }
        // fetchData()
        // fetchTodaysAttendance()
    }, [])
    useEffect(() => {
        async function fetchData() {
           const data = await GetAttendanceByDate(date)
        //    console.log(data)
           setAttendanceList(data)
        }
        fetchData()
    }, [date])
    // async function fetchTodaysAttendance() {
    //     const data = await GetAttendanceByDate(format(new Date(), 'dd-MM-yyyy'))
    //     console.log(data)
    //     setAttendanceList(data)
    // }


    function convertToAmPm(timeStr: string) {
        const [hour, minute, sec] = timeStr.split(':');
        let h = parseInt(hour);
        const ampm = h >= 12 ? 'pm' : 'am';
        h = h % 12 || 12; // convert 0 to 12
        return `${h.toString().padStart(2, '0')}:${minute} ${ampm}`;
      }
    return (
        <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
            <div className='flex items-center justify-between'>
                <h1 className='text-xl font-semibold'>View Attendance</h1>
            </div>
            <Separator />
            <div className='flex items-center justify-between gap-4'>
                <DatePickerDemo onDateChange={(date) => setDate(date)} />
                {/* <ItemSelector data={memberList} valueKey='id' labelKey='name' onSelect={(id) => setSelectedMember(id)} placeholder='Select Member' searchPlaceholder='Search Member' /> */}
                {/* <Button onClick={handleCheckIn} disabled={!selectedMember}>Check In</Button> */}
            </div>
            <Separator />
            <Card>
                <CardHeader>
                    <CardTitle>
                        <h2 className='text-xl font-semibold'>Attendance <span className='text-muted-foreground italic'>{date}</span></h2>
                    </CardTitle>
                </CardHeader>
                    <CardContent className=''>
                        <div className=''>
                            {
                                attendanceList.length === 0 ? <p className='text-muted-foreground flex items-center justify-center border-dashed border-2 border-muted rounded-md p-2 py-8'>No attendance records found</p> :
                                attendanceList.map((attendance, index) => (
                                    <div key={attendance.id} className='flex gap-4 hover:bg-muted rounded-md p-2'>
                                        <p>{index + 1}</p>
                                        <p>{attendance.member.name}</p>
                                        <p className='ml-auto'>{attendance.time && convertToAmPm(attendance.time)}</p>
                                    </div>
                                ))
                            }
                        </div>
                    </CardContent>
            </Card>
        </div>
    )
}

export default page