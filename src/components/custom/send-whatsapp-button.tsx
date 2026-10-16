'use client'
import { SendWhatsappMessage } from '@/action/whatsapp.action'
import { SendInvoiceOnWhatsapp } from '@/action/sales.action'
import { call } from '@/lib/action-result'
import { Button } from '@/components/ui/button'
import { IconCheck, IconSend } from '@tabler/icons-react'
import Link from 'next/link'
import React, { useState } from 'react'
import { toast } from 'sonner'

interface Props {
    name: string
    phone: string | number | bigint
    // The message; or `invoiceFor` a sale id, to send that invoice as a PDF.
    message?: string
    invoiceFor?: string
    // Text next to the icon; icon only when left out.
    label?: string
}

// Sends the message from the gym's own WhatsApp, right from the app (no
// WhatsApp window opens). Shows a tick once queued so it is not sent twice.
export function SendWhatsappButton({ name, phone, message = '', invoiceFor, label }: Props) {
    const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
    const send = async (e: React.MouseEvent) => {
        e.stopPropagation()
        if (state !== 'idle') return
        setState('sending')
        try {
            // Older message texts were written for a link and use %0A for new lines.
            await call(invoiceFor
                ? SendInvoiceOnWhatsapp(invoiceFor)
                : SendWhatsappMessage(name, String(phone), message.replace(/%0A/g, '\n')))
            setState('sent')
            toast.success(`Message to ${name} is on its way`, {
                description: 'Sent from your gym WhatsApp within seconds.',
                action: { label: 'View', onClick: () => window.location.assign('/whatsapp?tab=log') },
            })
        } catch (error: any) {
            setState('idle')
            toast.error(error.message)
        }
    }
    return (
        <Button size={label ? 'sm' : 'icon'} variant={state === 'sent' ? 'secondary' : 'default'} disabled={state === 'sending'} onClick={send} title={state === 'sent' ? 'Sent' : 'Send on WhatsApp'} className='gap-1'>
            {state === 'sent' ? <IconCheck size={16} /> : <IconSend size={16} />}
            {label && (state === 'sent' ? 'Sent' : label)}
        </Button>
    )
}
