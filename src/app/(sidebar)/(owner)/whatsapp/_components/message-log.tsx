'use client'
import { GetMessages, MessageResponse, RetryFailedMessages } from '@/action/whatsapp.action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { format } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const VARIANTS = { sent: 'default', pending: 'secondary', failed: 'destructive' } as const
const LABELS = { sent: 'Sent', pending: 'Waiting', failed: 'Failed' }

const MessageLog = () => {
    const [messages, setMessages] = useState<MessageResponse[]>([])

    const load = async () => setMessages(await GetMessages())
    useEffect(() => {
        load()
        const timer = setInterval(load, 10000)
        return () => clearInterval(timer)
    }, [])

    const retry = async () => {
        const count = await RetryFailedMessages()
        toast.success(`${count} message${count === 1 ? '' : 's'} queued again`)
        load()
    }

    const hasFailed = messages.some((message) => message.status === 'failed')

    return (
        <div className='space-y-3'>
            <div className='flex items-center justify-between'>
                <p className='text-muted-foreground text-sm'>The latest 200 messages.</p>
                {hasFailed && <Button variant='outline' size='sm' onClick={retry}>Retry failed</Button>}
            </div>
            {messages.length === 0 && (
                <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>Nothing sent yet.</p>
            )}
            {messages.map((message) => (
                <div key={message.id} className='space-y-2 rounded-lg border p-4'>
                    <div className='flex items-start justify-between gap-4'>
                        <div>
                            <p className='font-medium'>{message.name} <span className='text-muted-foreground font-normal'>· {message.phone}</span></p>
                            <p className='text-muted-foreground text-sm'>
                                {message.source} · {format(message.sentAt ?? message.createdAt, 'dd MMM, h:mm a')}
                            </p>
                        </div>
                        <Badge variant={VARIANTS[message.status]}>{LABELS[message.status]}</Badge>
                    </div>
                    <p className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>{message.body}</p>
                    {message.error && <p className='text-destructive text-sm'>{message.error}</p>}
                </div>
            ))}
        </div>
    )
}

export default MessageLog
