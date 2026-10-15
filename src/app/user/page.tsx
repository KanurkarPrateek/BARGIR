'use client'
import { getAllDetailsOfMember } from '@/action/user.action'
import React, { useEffect } from 'react'
import UserDetails from './_components/UserDetails'
import Header from './_components/Header'
import AttendanceSum from './_components/AttendanceSum'
import Sales from './_components/Sales'
import { Separator } from '@/components/ui/separator'
import { Button } from '@/components/ui/button'
import { IconKey, IconLogout } from '@tabler/icons-react'
import Link from 'next/link'

type Props = {}

const page = (props: Props) => {
  const [userData, setUserData] = React.useState<any>({})
  useEffect(() => {
    async function fetchData() {
      // if(localStorage){
      //   const member_id = localStorage.getItem('member_id')
      //   console.log(await getAllDetailsOfMember(member_id || ''))
      //   setUserData(await getAllDetailsOfMember(member_id || ''))
      // }
      if (typeof window !== 'undefined') {
        const member_id = localStorage.getItem('member_id')
        console.log(await getAllDetailsOfMember(member_id || ''))
        setUserData(await getAllDetailsOfMember(member_id || ''))
      }
    }
    fetchData()
  }, [])
  return (
    <div className='p-4 grid grid-cols-1 gap-4  max-w-xl mx-auto'>
      <Header user_name={userData?.user?.name} />
      <UserDetails user={userData?.user} />
      <AttendanceSum attendance={userData?.allAttendanceOfMember} />
      <Sales activeSales={userData?.activeSales} expiredSales={userData?.inActiveSales} />
      <Separator />
      <Link href={'/user/change-password'}>
        <Button variant={'ghost'} className='w-fit'>
          <IconKey className='mr-2' />
          Change password
        </Button>
      </Link>
      <Button variant={'ghost'} className='text-red-500 w-fit' onClick={() => {
        localStorage.removeItem('member_id');
        window.location.href = '/login'
      }}>
        <IconLogout className='mr-2 items-start justify-center' />
        Log out
      </Button>
    </div>
  )
}

export default page