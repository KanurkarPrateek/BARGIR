'use client'
import { call } from '@/lib/action-result'
import { useGymName } from '@/hooks/use-gym-name'
import { SendWhatsappButton } from '@/components/custom/send-whatsapp-button'
import { GetAllMembers } from '@/action/member.action'
import { DeleteSaleById, GetAllSalesWithExpand, SalesResponse } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { IconFile, IconSend, IconTrash } from '@tabler/icons-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { toast } from 'sonner'

type Props = {}
const columns = [
  {
    accessorKey: 'service_name',
    header: 'Service Name',
  },
  {
    accessorKey: 'member_name',
    header: 'Member Name',
  },
  {
    accessorKey: 'startDate',
    header: 'Start',
    cellClassName: 'capitalize',
  },
  {
    accessorKey: 'endDate',
    header: 'End',
    cellClassName: 'capitalize',
  },
  {
    accessorKey: 'dueAmount',
    header: 'Due',
  },
]

const SalesPage = (props: Props) => {
    const gymName = useGymName()
  const [salesList, setSalesList] = React.useState<SalesResponse[]>([])
  const { showLoading, hideLoading, isLoading } = useLoading()
  const router = useRouter()
  useEffect(() => {
    async function fetchData() {
      const data = await GetAllSalesWithExpand()
      setSalesList(data)
      hideLoading()
    }
    showLoading()
    fetchData()
  }, [])

  const DeleteColumn = [
    {
      accessorKey: 'id',
      header: 'Delete',
      cellContent: <Button variant="destructive" className='cursor-pointer'><IconTrash size={16} /></Button>,
      onClick: async (rowId: any) => {
        if (!confirm('Delete this sale?')) return
        try {
          await call(DeleteSaleById(rowId))
          toast.success("Sales deleted successfully")
          window.location.reload()
        } catch (error: any) {
          toast.error(error.message)
        }
      },

    },
    {
      accessorKey: 'id',
      header: 'Invoice',
      cellContent: <Button size={"sm"} variant={"secondary"} className='cursor-pointer'><IconFile /></Button>,
      onClick: async (rowId: any) => {
        router.push(`/invoices/${rowId}`)
      },

    },
    {
      accessorKey: 'id',
      header: 'Send',
      cellContentGetRow: (row: any) => (
        <SendWhatsappButton
          name={row.member_name}
          phone={row.member.phone}
          message={`Hi ${row.member_name}, here is the invoice for your ${row.service_name}. Thank you for choosing ${gymName}. Stay healthy, stay strong!\n\n${typeof window === 'undefined' ? '' : window.location.origin}/invoices/${row.id}`}
        />
      ),
    }
  ]
  return (
    <div className='max-w-xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <h1 className='text-xl font-semibold'>View Subscriptions</h1>
        <Link href={'/sales/new'}>
          <Button>Add Subscription</Button>
        </Link>
      </div>
      <Separator />
      <DataTable dataRows={salesList} actionColumns={DeleteColumn} columns={columns} isLoading={isLoading} />
    </div>
  )
}

export default SalesPage