'use client'
import { paymentReminder } from '@/lib/whatsapp/messages'
import { useGymName } from '@/hooks/use-gym-name'
import { GetSalesWithPendingAmount } from '@/action/sales.action'
import { DataTable } from '@/components/custom/data-table'
import { Button } from '@/components/ui/button'
import { IconSend } from '@tabler/icons-react'
import { useRouter } from 'next/navigation'
import React, { useEffect } from 'react'
import { RecordPaymentDialog } from '@/components/custom/record-payment-dialog'
import { SendWhatsappButton } from '@/components/custom/send-whatsapp-button'
import { Card, CardAction, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

type Props = {}

const columns = [
    {
        accessorKey: 'member_name',
        header: 'Member',
    },
    {
        accessorKey: 'member_phone',
        header: 'Phone',
    },
    {
        accessorKey: 'service_name',
        header: 'Service',
    },
    {
        accessorKey: 'due',
        header: 'Due',
    },
]


const PendingPayments = ({ }: Props) => {
    const gymName = useGymName()
    const router = useRouter()
    const [data, setData] = React.useState<any>()
    const [isLoading, setIsLoading] = React.useState(true)
    const fetchData = async () => {
        try {
            setData(await GetSalesWithPendingAmount())
        } catch (error) {
            console.error("Error fetching data:", error)
        }
        setIsLoading(false)
    }
    useEffect(() => {
        fetchData()
    }, [])

    const actions = [
        {
            accessorKey: 'id',
            header: 'Message',
            cellContentGetRow: (row: any) => (
                <SendWhatsappButton
                    name={row.member_name}
                    phone={row.member_phone}
                    message={paymentReminder(row.member_name, row.service_name, row.due, gymName)}
                />
            ),
        },
        {
            accessorKey: 'id',
            header: 'Pay',
            cellContentGetRow: (row: any) => <RecordPaymentDialog sale={row} onSuccess={fetchData} />,
        }
    ]
    return (
            <Card>
                <CardHeader>
                    <CardTitle>Pending Payments</CardTitle>
                    <CardAction className="text-muted-foreground">Total Amount: ₹{(data?.total || 0)}</CardAction>
                </CardHeader>
                <CardContent>
                    <DataTable dataRows={data?.sales || []} isLoading={isLoading} columns={columns} actionColumns={actions} onItemClick={(row) => router.push(`/members/${row.member_id}`)} />

                </CardContent>
            </Card>
    )
}

export default PendingPayments