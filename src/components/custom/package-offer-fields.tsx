'use client'
import { DatePickerDemo } from '@/components/custom/date-picker'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { rupees } from '@/lib/membership'
import { activeOffer } from '@/lib/offers'

export interface OfferDraft {
    price: number
    discountType?: string | null
    discountValue?: number
    offerTill?: string | null
}

// The "Offer" part of Add Package / Edit Package: none, % off or ₹ off, and an
// optional last day. Shows the price members will actually pay.
export function PackageOfferFields<T extends OfferDraft>({ value, onChange }: { value: T; onChange: (next: T) => void }) {
    const type = value.discountType ?? 'none'
    const offer = activeOffer({ name: '', price: Number(value.price) || 0, discountType: value.discountType ?? null, discountValue: Number(value.discountValue) || 0, offerTill: value.offerTill ?? null })
    return (
        <div className='space-y-3 rounded-lg border p-3'>
            <Label>Offer / discount</Label>
            <div className='flex flex-wrap items-center gap-2'>
                <Select value={type} onValueChange={(v) => onChange({ ...value, discountType: v === 'none' ? null : v, discountValue: v === 'none' ? 0 : value.discountValue })}>
                    <SelectTrigger className='w-36'><SelectValue /></SelectTrigger>
                    <SelectContent>
                        <SelectItem value='none'>No offer</SelectItem>
                        <SelectItem value='percent'>% off</SelectItem>
                        <SelectItem value='flat'>₹ off</SelectItem>
                    </SelectContent>
                </Select>
                {type !== 'none' && (
                    <Input type='number' min={1} className='w-28' placeholder={type === 'percent' ? '10' : '200'} value={value.discountValue || ''} onChange={(e) => onChange({ ...value, discountValue: Number(e.target.value) })} />
                )}
            </div>
            {type !== 'none' && (
                <div className='space-y-1'>
                    <Label className='font-normal'>Valid till <span className='text-muted-foreground'>(leave empty for no end date)</span></Label>
                    <div className='flex items-center gap-2'>
                        <DatePickerDemo key={value.offerTill ?? 'none'} defaultDate={value.offerTill ?? undefined} onDateChange={(d) => onChange({ ...value, offerTill: d })} />
                        {value.offerTill && <button type='button' className='text-muted-foreground text-xs underline' onClick={() => onChange({ ...value, offerTill: null })}>no end date</button>}
                    </div>
                </div>
            )}
            {offer && <p className='text-sm'>Members pay <strong>{rupees(offer.offerPrice)}</strong> instead of {rupees(Number(value.price))} ({offer.label}).</p>}
        </div>
    )
}
