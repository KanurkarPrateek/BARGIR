'use client'
import { call } from '@/lib/action-result'
import { CampaignResponse, GetAudienceSize, GetCampaigns, SendCampaign } from '@/action/whatsapp.action'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { AUDIENCES, CAMPAIGN_PLACEHOLDERS, CampaignAudience, PACKAGE_PLACEHOLDERS } from '@/lib/whatsapp/constants'
import { GetAllServices, ServiceResponse } from '@/action/service.action'
import { activeOffer, offerValues } from '@/lib/offers'
import { OFFER_TEMPLATES } from '@/lib/whatsapp/messages'
import { useSearchParams } from 'next/navigation'
import { format } from 'date-fns'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'
import TemplateEditor from './template-editor'

const audienceLabel = (value: CampaignAudience) => AUDIENCES.find((a) => a.value === value)?.label

const OffersTab = () => {
    const [title, setTitle] = useState('')
    const params = useSearchParams()
    const [template, setTemplate] = useState('')
    const [packages, setPackages] = useState<ServiceResponse[]>([])
    const [packageId, setPackageId] = useState<string>('none')
    const [audience, setAudience] = useState<CampaignAudience>('active_members')
    const [audienceSize, setAudienceSize] = useState<number | null>(null)
    const [campaigns, setCampaigns] = useState<CampaignResponse[]>([])
    const [sending, setSending] = useState(false)

    const loadCampaigns = async () => setCampaigns(await GetCampaigns())

    // Picking a package fills in a ready offer message; it can still be edited.
    const choosePackage = (id: string, list = packages) => {
        setPackageId(id)
        const pkg = list.find((p) => p.id === id)
        if (!pkg) return
        const offer = activeOffer(pkg)
        setTitle(`${pkg.name} offer`)
        setTemplate(offer ? OFFER_TEMPLATES.withOffer(!!offer.till) : OFFER_TEMPLATES.noOffer)
    }

    useEffect(() => {
        GetAllServices().then((list) => {
            setPackages(list)
            const fromLink = params.get('package')
            if (fromLink) choosePackage(fromLink, list)
        })
    }, [])

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
            const queued = await call(SendCampaign({ title, template, audience, service_id: packageId === 'none' ? null : packageId }))
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
                    <Label>About a package <span className='text-muted-foreground font-normal'>(optional)</span></Label>
                    <Select value={packageId} onValueChange={choosePackage}>
                        <SelectTrigger className='w-full'><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value='none'>No particular package</SelectItem>
                            {packages.map((p) => {
                                const offer = activeOffer(p)
                                return <SelectItem key={p.id} value={p.id}>{p.name}{offer ? ` — ${offer.label}` : ''}</SelectItem>
                            })}
                        </SelectContent>
                    </Select>
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
                <TemplateEditor value={template} onChange={setTemplate} placeholders={packageId === 'none' ? CAMPAIGN_PLACEHOLDERS : [...CAMPAIGN_PLACEHOLDERS, ...PACKAGE_PLACEHOLDERS]}
                    sample={(() => { const pkg = packages.find((p) => p.id === packageId); return pkg ? offerValues(pkg) : undefined })()} />
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
