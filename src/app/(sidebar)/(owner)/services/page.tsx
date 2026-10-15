'use client'
import { GetAllMembers } from '@/action/member.action'
import { DeleteServiceById, GetAllServices, ServiceResponse, SetServicePersonalTraining } from '@/action/service.action'
import { Switch } from '@/components/ui/switch'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import React, { useEffect } from 'react'
import { toast } from 'sonner'

type Props = {}
const columns = [
  {
    accessorKey: 'name',
    header: 'Name',
  },
  {
    accessorKey: 'description',
    header: 'Description',
  },
  {
    accessorKey: 'price',
    header: 'Price',
  },
  {
    accessorKey: 'duration',
    header: 'Duration',
  }
]

const DeleteColumn = [{
  accessorKey: 'id',
  header: 'Action',
  cellContent: <Button variant="destructive" size={"icon"} className='cursor-pointer'><IconTrash size={16} /></Button>,
  onClick: async (rowId: any) => {
    const result = await DeleteServiceById(rowId)
    toast.success("Service deleted successfully")
  }
}]

const MemberPage = (props: Props) => {
  const [serviceList, setServiceList] = React.useState<ServiceResponse[]>([])
  const { showLoading, hideLoading, isLoading } = useLoading()
  useEffect(() => {
    async function fetchData() {
      const data = await GetAllServices()
      setServiceList(data)
      hideLoading()
    }
    showLoading()
    fetchData()

  }, [])

  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>View Package</h1>
        <Link href={'/services/new'}>
          <Button>Add Package</Button>
        </Link>
      </div>
      <Separator />
      <p className='text-muted-foreground text-sm'>
        Switch on "Personal training" for PT packages. Members who buy one appear under Trainers → PT clients.
      </p>
      <DataTable dataRows={serviceList} columns={columns}
        actionColumns={[{
          accessorKey: 'id',
          header: 'Personal training',
          cellContentGetRow: (row: ServiceResponse) => (
            <Switch
              checked={row.isPersonalTraining}
              onCheckedChange={async (checked) => {
                setServiceList((list) => list.map((service) => service.id === row.id ? { ...service, isPersonalTraining: checked } : service))
                await SetServicePersonalTraining(row.id, checked)
              }}
            />
          ),
        }]}
        isLoading={isLoading} />
    </div>
  )
}

export default MemberPage