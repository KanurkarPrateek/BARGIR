'use client'
import { call } from '@/lib/action-result'
import { GetAllMembers, MemberResponse } from '@/action/member.action'
import { AddSales, SalesInput } from '@/action/sales.action'
import { GetAllServices, ServiceResponse } from '@/action/service.action'
import { DatePickerDemo } from '@/components/custom/date-picker'
import ItemSelector from '@/components/custom/item-selector'
import { TrainerSelect } from '@/components/custom/trainer-select'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { useLoading } from '@/hooks/use-loading'
import { PAYMENT_MODES, PaymentMode, rupees } from '@/lib/membership'
import { addMonths, format, parse } from 'date-fns'
import React, { useEffect } from 'react'
import { toast } from 'sonner'
import { describeDelivery } from '@/lib/invoice-delivery'
import { BackdateBanner } from '@/components/custom/backdate-banner'

const today = () => format(new Date(), 'dd-MM-yyyy')

const page = ({ searchParams }: { searchParams: any }) => {
    // Coming from a member's profile preselects the member (and, for a
    // renewal, the plan they were on).
    const preset = React.use(searchParams) as { member?: string; service?: string; backdate?: string }
    const backdated = preset.backdate === '1'
    const [members, setMembers] = React.useState<MemberResponse[]>([])
    const [services, setServices] = React.useState<ServiceResponse[]>([])
    const { showLoading, hideLoading } = useLoading()
    const [formState, setFormState] = React.useState<SalesInput>({
        member_id: preset.member ?? '',
        service_id: '',
        description: '',
        discount: 0,
        amount: 0,
        paid: 0,
        startDate: today(),
        paymentMode: 'cash',
        backdated,
        paymentDate: today(),
    })
    useEffect(() => {
        async function fetchData() {
            setMembers(await GetAllMembers())
            const allServices = await GetAllServices()
            setServices(allServices)
            const service = allServices.find((s) => s.id === preset.service)
            if (service) setFormState((prev) => ({ ...prev, service_id: service.id, amount: service.price }))
        }
        fetchData()
    }, [])
    const handleInputChange = (
        e: any,
        field: keyof SalesInput
    ) => {
        setFormState((prev) => ({ ...prev, [field]: e }))
    }

    const service = services.find((s) => s.id === formState.service_id)
    const payable = formState.amount - formState.discount
    const due = payable - formState.paid
    const endDate = service && formState.startDate
        ? format(addMonths(parse(formState.startDate, 'dd-MM-yyyy', new Date()), service.duration), 'dd-MM-yyyy')
        : null

    const handleOnSubmit = async () => {
        if (formState.member_id === '' || formState.service_id === '' || formState.startDate === '') {
            toast.error('Choose the member, the plan and the start date')
            return
        }
        if (formState.amount <= 0) {
            toast.error('Amount must be greater than zero')
            return
        }
        if (due < 0) {
            toast.error('Amount paid is more than the amount to be paid')
            return
        }
        showLoading()
        try {
            const sale = await call(AddSales(formState))
            toast.success(due > 0 ? `Sale added. ${rupees(due)} is due.` : 'Sale added, fully paid', {
                description: describeDelivery(sale.invoice),
            })
            // Leave the message on screen long enough to read before moving on.
            await new Promise((resolve) => setTimeout(resolve, 1200))
            window.location.href = `/members/${formState.member_id}`
        } catch (error: any) {
            toast.error(error.message)
        }
        hideLoading()
    }
    return (
        <div className="max-w-xl w-full mx-auto space-y-6 p-4">
            <div>
                <h1 className="text-3xl font-semibold">{backdated ? 'BackDate Renew Subscription' : 'Add Subscription'}</h1>
                <p className="text-muted-foreground text-sm">Fields marked with <span className="text-destructive">*</span> are required</p>
            </div>
            <Separator className="" />
            {backdated && <BackdateBanner what="subscriptions sold" />}
            <div className="space-y-2">
                <Label>
                    Member <span className="text-destructive">*</span>
                </Label>
                <ItemSelector data={members} valueKey="id" labelKey="name" defaultValue={formState.member_id} onSelect={(value) => handleInputChange(value, "member_id")} placeholder="Select a member" searchPlaceholder="Search members..." />
            </div>
            <div className="space-y-2">
                <Label>
                    Plan / service <span className="text-destructive">*</span>
                </Label>
                <ItemSelector data={services} valueKey="id" labelKey="name" defaultValue={formState.service_id} onSelect={(value) => handleInputChange(value, "service_id")} placeholder="Select a plan" searchPlaceholder="Search plans..."
                    onSelectGetRow={(row) => setFormState((prev) => ({ ...prev, amount: row.price }))}
                />
                {service && (
                    <p className="text-muted-foreground text-sm">
                        {rupees(service.price)} for {service.duration} month{service.duration === 1 ? '' : 's'}
                        {endDate && ` · runs till ${endDate}`}
                    </p>
                )}
            </div>
            <div className="space-y-2">
                <Label>
                    Start Date <span className="text-destructive">*</span>
                </Label>
                <DatePickerDemo
                    defaultDate={formState.startDate}
                    onDateChange={(e) => handleInputChange(e, "startDate")}
                />
            </div>
            <div className="space-y-2">
                <Label>
                    Trainer <span className="text-muted-foreground font-normal">(for personal training)</span>
                </Label>
                <TrainerSelect value={formState.trainer_id} onChange={(trainerId) => handleInputChange(trainerId ?? undefined, "trainer_id")} />
                {service?.isPersonalTraining && !formState.trainer_id && (
                    <p className="text-sm text-amber-600">This is a personal training package. Pick the trainer now, or assign one later under Trainers → PT clients.</p>
                )}
            </div>
            <Separator />
            <div className="space-y-2">
                <Label>
                    Discount
                </Label>
                <Input
                    placeholder="Discount"
                    type="number"
                    min={0}
                    value={formState.discount || ''}
                    onChange={(e) => handleInputChange(Number(e.target.value), "discount")}
                />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <Label>
                        Amount paid now
                    </Label>
                    <Input
                        placeholder="0 if paying later"
                        type="number"
                        min={0}
                        value={formState.paid || ''}
                        onChange={(e) => handleInputChange(Number(e.target.value), "paid")}
                    />
                </div>
                <div className="space-y-2">
                    <Label>
                        Paid by
                    </Label>
                    <Select value={formState.paymentMode} onValueChange={(value) => handleInputChange(value as PaymentMode, "paymentMode")}>
                        <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            {PAYMENT_MODES.map((m) => (
                                <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            {backdated && formState.paid > 0 && (
                <div className="space-y-2">
                    <Label>Date the money was received</Label>
                    <DatePickerDemo defaultDate={formState.paymentDate} onDateChange={(e) => handleInputChange(e, "paymentDate")} />
                </div>
            )}
            <Button variant="outline" size="sm" onClick={() => handleInputChange(payable, "paid")} disabled={payable <= 0}>
                Paid in full ({rupees(Math.max(payable, 0))})
            </Button>
            <div className="space-y-2">
                <Label>
                    Note
                </Label>
                <Input
                    placeholder="Anything worth remembering about this sale"
                    type="text"
                    value={formState.description}
                    onChange={(e) => handleInputChange(e.target.value, "description")}
                />
            </div>

            <Card>
                <CardContent className="grid grid-cols-2 gap-y-1 text-sm">
                    <span className="text-muted-foreground">Plan price</span><span className="text-right">{rupees(formState.amount)}</span>
                    <span className="text-muted-foreground">Discount</span><span className="text-right">- {rupees(formState.discount)}</span>
                    <span className="text-muted-foreground">Paid now</span><span className="text-right">- {rupees(formState.paid)}</span>
                    <span className="font-medium">Due</span><span className={`text-right font-medium ${due > 0 ? 'text-destructive' : ''}`}>{rupees(due)}</span>
                </CardContent>
            </Card>
            <Separator />
            <Button className="w-full md:w-fit px-8" onClick={handleOnSubmit}>
                Create
            </Button>
        </div>
    )
}

export default page
