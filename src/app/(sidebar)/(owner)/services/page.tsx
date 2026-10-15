'use client'
import { GetAllServices, ServiceInput, ServiceResponse, SetServicePersonalTraining, UpdateService } from '@/action/service.action'
import { call } from '@/lib/action-result'
import { PackageOfferFields } from '@/components/custom/package-offer-fields'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { rupees } from '@/lib/membership'
import { activeOffer } from '@/lib/offers'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import React, { useEffect, useState } from 'react'
import { toast } from 'sonner'

type Editing = ServiceInput & { id: string }

// View Package: every plan with its price, any running offer, and one-click
// buttons to change it or announce the offer on WhatsApp.
const PackagesPage = () => {
  const router = useRouter()
  const [packages, setPackages] = useState<ServiceResponse[]>([])
  const [editing, setEditing] = useState<Editing | null>(null)
  const load = async () => setPackages(await GetAllServices())
  useEffect(() => { load() }, [])

  const save = async () => {
    try {
      await call(UpdateService(editing!.id, editing!))
      toast.success('Package saved')
      setEditing(null)
      load()
    } catch (error: any) { toast.error(error.message) }
  }
  const togglePt = async (p: ServiceResponse, on: boolean) => {
    setPackages((list) => list.map((x) => (x.id === p.id ? { ...x, isPersonalTraining: on } : x)))
    await SetServicePersonalTraining(p.id, on)
  }

  return (
    <div className='max-w-3xl w-full mx-auto space-y-6 p-4'>
      <div className='flex items-center justify-between'>
        <div>
          <h1 className='text-xl font-semibold'>View Package</h1>
          <p className='text-muted-foreground text-sm'>Set an offer on a package and it is applied automatically when sold. "Send offer" tells your members on WhatsApp.</p>
        </div>
        <Link href='/services/new'><Button>Add Package</Button></Link>
      </div>
      <Separator />
      {packages.length === 0 && <p className='text-muted-foreground rounded-lg border p-6 text-center text-sm'>No packages yet.</p>}
      {packages.map((p) => {
        const offer = activeOffer(p)
        const expiredOffer = !offer && p.discountType && p.discountValue > 0
        return (
          <div key={p.id} className='space-y-2 rounded-lg border p-4'>
            <div className='flex flex-wrap items-start gap-2'>
              <div>
                <p className='font-medium'>{p.name}</p>
                <p className='text-muted-foreground text-sm'>
                  {p.duration} month{p.duration > 1 ? 's' : ''} · {offer
                    ? <><span className='line-through'>{rupees(p.price)}</span> <strong className='text-foreground'>{rupees(offer.offerPrice)}</strong></>
                    : rupees(p.price)}
                </p>
              </div>
              <span className='ml-auto flex flex-wrap items-center gap-2'>
                {offer && <Badge>{offer.label}{offer.till ? ` till ${offer.till}` : ''}</Badge>}
                {expiredOffer && <Badge variant='outline'>Offer ended {p.offerTill}</Badge>}
                <label className='text-muted-foreground flex items-center gap-1 text-xs'>
                  <Switch checked={p.isPersonalTraining} onCheckedChange={(on) => togglePt(p, on)} /> Personal training
                </label>
              </span>
            </div>
            <div className='flex gap-2'>
              <Button size='sm' variant='outline' onClick={() => setEditing({ ...p, description: p.description ?? '' })}>Edit</Button>
              <Button size='sm' variant={offer ? 'default' : 'outline'} onClick={() => router.push(`/whatsapp?tab=offers&package=${p.id}`)}>Send offer</Button>
            </div>
          </div>
        )
      })}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className='max-h-[90vh] overflow-y-auto'>
          <DialogHeader><DialogTitle>Edit Package</DialogTitle></DialogHeader>
          {editing && (
            <div className='space-y-4'>
              <div className='space-y-2'><Label>Name</Label><Input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></div>
              <div className='grid grid-cols-2 gap-4'>
                <div className='space-y-2'><Label>Price (₹)</Label><Input type='number' value={editing.price} onChange={(e) => setEditing({ ...editing, price: Number(e.target.value) })} /></div>
                <div className='space-y-2'><Label>Duration (months)</Label><Input type='number' value={editing.duration} onChange={(e) => setEditing({ ...editing, duration: Number(e.target.value) })} /></div>
              </div>
              <PackageOfferFields value={editing} onChange={setEditing} />
              <p className='text-muted-foreground text-xs'>Changes apply to new sales only. Existing subscriptions keep the price they were sold at.</p>
            </div>
          )}
          <DialogFooter>
            <Button variant='outline' onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default PackagesPage
