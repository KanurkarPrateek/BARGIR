'use client'
import { call } from '@/lib/action-result'
import { CampaignResponse, GetAudienceSize, GetCampaigns, SendCampaign } from '@/action/whatsapp.action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { AUDIENCES, CAMPAIGN_PLACEHOLDERS, CampaignAudience } from '@/lib/whatsapp/constants'
import { format } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TemplateEditor from './template-editor'

const audienceLabel = (value: CampaignAudience) => AUDIENCES.find((a) => a.value === value)?.label

const OffersTab = () => {
    const [title, setTitle] = useState('')
    const [template, setTemplate] = useState('')
    const [audience, setAudience] = useState<CampaignAudience>('active_members')
    const [audienceSize, setAudienceSize] = useState<number | null>(null)
    const [campaigns, setCampaigns] = useState<CampaignResponse[]>([])
    const [sending, setSending] = useState(false)

    const loadCampaigns = async () => setCampaigns(await GetCampaigns())

    useEffect(() => {
        loadCampaigns()
        // Keeps the sent / waiting counts moving while a broadcast goes out.
        const timer = setInterval(loadCampaigns, 10000)
        return () => clearInterval(timer)
    }, [])

    useEffect(() => {
        setAudienceSize(null)
        GetAudienceSize(audience).then(setAudienceSize)
    }, [audience])

    const send = async () => {
        if (!confirm(`Send this offer on WhatsApp to ${audienceSize} people?`)) return
        setSending(true)
        try {
            const queued = await call(SendCampaign({ title, template, audience }))
            toast.success(`Offer queued for ${queued} people`)
            setTitle('')
            setTemplate('')
            loadCampaigns()
        } catch (error: any) {
            toast.error(error.message)
        }
        setSending(false)
    }

    return (
        <div className='space-y-6'>
            <div className='space-y-4 rounded-lg border p-4'>
                <div className='space-y-2'>
                    <Label>Offer title <span className='text-muted-foreground font-normal'>(only you see this)</span></Label>
                    <Input placeholder='e.g. Diwali offer' value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className='space-y-2'>
                    <Label>Send to</Label>
                    <Select value={audience} onValueChange={(value) => setAudience(value as CampaignAudience)}>
                        <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {AUDIENCES.map((a) => (
                                <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <p className='text-muted-foreground text-xs'>
                        {audienceSize === null ? 'Counting…' : `${audienceSize} ${audienceSize === 1 ? 'person' : 'people'} will get this message.`}
                    </p>
                </div>
                <TemplateEditor value={template} onChange={setTemplate} placeholders={CAMPAIGN_PLACEHOLDERS} />
                <Button onClick={send} disabled={sending || !audienceSize || !title.trim() || !template.trim()}>
                    {sending ? 'Queuing…' : 'Send offer'}
                </Button>
            </div>

            {campaigns.length > 0 && (
                <div className='space-y-3'>
                    <h2 className='font-medium'>Past offers</h2>
                    <Separator />
                    {campaigns.map((campaign) => (
                        <div key={campaign.id} className='space-y-2 rounded-lg border p-4'>
                            <div>
                                <p className='font-medium'>{campaign.title}</p>
                                <p className='text-muted-foreground text-sm'>
                                    {format(campaign.createdAt, 'dd MMM yyyy, h:mm a')} · {audienceLabel(campaign.audience)}
                                </p>
                            </div>
                            <p className='bg-muted rounded-md px-3 py-2 text-sm whitespace-pre-wrap'>{campaign.template}</p>
                            <p className='text-sm'>
                                {campaign.counts.sent} sent
                                {campaign.counts.pending > 0 && ` · ${campaign.counts.pending} waiting`}
                                {campaign.counts.failed > 0 && ` · ${campaign.counts.failed} failed`}
                            </p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    )
}

export default OffersTab
