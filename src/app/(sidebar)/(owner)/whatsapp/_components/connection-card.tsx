'use client'
import { call } from '@/lib/action-result'
import { DisconnectWhatsapp, GetWhatsappConnection, SendTestMessage } from '@/action/whatsapp.action'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import type { Connection } from '@/lib/whatsapp/client'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

const LABELS: Record<Connection['state'], string> = {
    connected: 'Connected',
    qr: 'Scan to connect',
    starting: 'Starting…',
    offline: 'Offline',
}

const ConnectionCard = () => {
    const [connection, setConnection] = useState<Connection | null>(null)
    const [testPhone, setTestPhone] = useState('')

    useEffect(() => {
        let cancelled = false
        const refresh = async () => {
            const result = await GetWhatsappConnection().catch(
                () => ({ state: 'offline' } as Connection)
            )
            if (!cancelled) setConnection(result)
        }
        refresh()
        // The QR code rotates every few seconds until it is scanned.
        const timer = setInterval(refresh, 5000)
        return () => {
            cancelled = true
            clearInterval(timer)
        }
    }, [])

    const sendTest = async () => {
        try {
            await call(SendTestMessage(testPhone, 'Test message from your gym software ✅'))
            toast.success('Test message queued')
            setTestPhone('')
        } catch (error: any) {
            toast.error(error.message)
        }
    }

    const state = connection?.state

    return (
        <Card>
            <CardHeader>
                <CardTitle className='flex items-center gap-2'>
                    Gym WhatsApp number
                    {state && (
                        <Badge variant={state === 'connected' ? 'default' : state === 'offline' ? 'destructive' : 'secondary'}>
                            {LABELS[state]}
                        </Badge>
                    )}
                </CardTitle>
                <CardDescription>
                    {!state && 'Checking connection…'}
                    {state === 'connected' && `Messages are sent from ${connection?.number ? `+${connection.number}` : 'the linked WhatsApp account'}.`}
                    {state === 'qr' && 'On the gym phone open WhatsApp → Settings → Linked devices → Link a device, then scan this code.'}
                    {state === 'starting' && 'WhatsApp is starting up, this takes up to a minute.'}
                    {state === 'offline' && 'The WhatsApp sender is waking up or not running. Messages wait in the queue for up to 24 hours.'}
                </CardDescription>
            </CardHeader>
            {state === 'qr' && connection?.qr && (
                <CardContent>
                    <img src={connection.qr} alt='WhatsApp QR code' className='size-56 rounded-md bg-white p-2' />
                </CardContent>
            )}
            {state === 'connected' && (
                <CardContent className='flex gap-2'>
                    <Input
                        placeholder='Phone number for a test message'
                        type='tel'
                        value={testPhone}
                        onChange={(e) => setTestPhone(e.target.value)}
                        className='max-w-xs'
                    />
                    <Button variant='outline' onClick={sendTest}>Send test</Button>
                    <Button
                        variant='ghost'
                        className='text-destructive ml-auto'
                        onClick={() => confirm('Unlink this WhatsApp number? Messages stop until a number is linked again.') && DisconnectWhatsapp()}
                    >
                        Unlink
                    </Button>
                </CardContent>
            )}
        </Card>
    )
}

export default ConnectionCard
