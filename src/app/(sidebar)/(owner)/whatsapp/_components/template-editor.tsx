'use client'
import { Label } from '@/components/ui/label'
import { renderTemplate } from '@/lib/whatsapp/constants'
import React, { useRef } from 'react'

type Props = {
    value: string
    onChange: (value: string) => void
    placeholders: string[]
}

// Sample values so admins see what a real person would receive.
const SAMPLE: Record<string, string> = {
    name: 'Rahul Sharma',
    first_name: 'Rahul',
    gym: 'Your Gym',
    service: 'Monthly Membership',
    expiry_date: '15-10-2026',
    followup_date: '15-10-2026',
    amount: '₹1,500',
    paid: '₹1,000',
    due: '₹500',
    invoice_link: 'https://yourgym.app/invoices/…',
}

const TemplateEditor = ({ value, onChange, placeholders }: Props) => {
    const textarea = useRef<HTMLTextAreaElement>(null)

    const insert = (placeholder: string) => {
        const el = textarea.current
        const token = `{${placeholder}}`
        const start = el?.selectionStart ?? value.length
        const end = el?.selectionEnd ?? value.length
        onChange(value.slice(0, start) + token + value.slice(end))
        requestAnimationFrame(() => {
            el?.focus()
            el?.setSelectionRange(start + token.length, start + token.length)
        })
    }

    return (
        <div className='space-y-2'>
            <Label>Message</Label>
            <textarea
                ref={textarea}
                rows={5}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder='Hi {first_name}, ...'
                className='border-input dark:bg-input/30 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/50 w-full rounded-md border bg-transparent px-3 py-2 text-sm shadow-xs outline-none focus-visible:ring-[3px]'
            />
            <div className='flex flex-wrap items-center gap-1.5 text-xs'>
                <span className='text-muted-foreground'>Insert:</span>
                {placeholders.map((placeholder) => (
                    <button
                        key={placeholder}
                        type='button'
                        onClick={() => insert(placeholder)}
                        className='bg-muted hover:bg-accent rounded px-1.5 py-0.5 font-mono'
                    >
                        {`{${placeholder}}`}
                    </button>
                ))}
            </div>
            {value.trim() && (
                <div className='space-y-1'>
                    <p className='text-muted-foreground text-xs'>Preview</p>
                    <div className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>
                        {renderTemplate(value, SAMPLE)}
                    </div>
                </div>
            )}
        </div>
    )
}

export default TemplateEditor
