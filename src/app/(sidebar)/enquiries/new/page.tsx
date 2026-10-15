"use client"

import { call } from '@/lib/action-result'
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import React, { useState } from "react"

import { toast } from "sonner"
import { BackdateBanner } from "@/components/custom/backdate-banner"
import { format } from "date-fns"
import { PHONE_ERROR, normalizeIndianMobile } from "@/lib/phone"

import { AddService, ServiceInput } from "@/action/service.action"
import { AddEnquiry, EnquiryInput } from "@/action/enquiries.action"
import { DatePickerDemo } from "@/components/custom/date-picker"
import ItemSelector from "@/components/custom/item-selector"
import { useLoading } from "@/hooks/use-loading"
import { capitalizeWords } from "@/lib/utils"
import { TrainerSelect } from "@/components/custom/trainer-select"




const page = ({ searchParams }: { searchParams: any }) => {
  const { backdate } = React.use(searchParams) as { backdate?: string }
  const backdated = backdate === "1"
  const [enquiryDate, setEnquiryDate] = useState(format(new Date(), "dd-MM-yyyy"))
  const { showLoading, hideLoading } = useLoading()
  // Bumped after each save so the date and type pickers clear too.
  const [formKey, setFormKey] = useState(0)
  const [formState, setFormState] = useState<EnquiryInput>({
    name: '',
    phone: BigInt(0),
    followupDate: '',
    message: '',
    type: 'walkin',
  })

  const handleInputChange = (
    e: any,
    field: keyof EnquiryInput
  ) => {
    setFormState((prev) => ({ ...prev, [field]: e }))
  }


  const handleOnSubmit = async () => {
    showLoading()
    // console.log(formState)
    if (formState.name === "" || formState.phone === null) {
      toast.error("Please fill all the required fields")
      hideLoading()
      return
    }
    if (!normalizeIndianMobile(formState.phone)) {
      toast.error(PHONE_ERROR)
      hideLoading()
      return
    }
    if (!formState.followupDate) {
      toast.error("Pick a follow up date")
      hideLoading()
      return
    }

    console.log("Form submitted with state:", formState)
    // db operation
    const response = await call(AddEnquiry({ ...formState, backdated, enquiryDate })).catch((error) => {
      toast.error(error.message)
      return null
    })
    if (!response) {
      hideLoading()
      return
    }
    if (response.id) {
      toast.success("Enquiry added successfully")
      setFormKey((key) => key + 1)
      setFormState(
        {
          name: '',
          phone: BigInt(0),
          followupDate: '',
          message: '',
          type: 'walkin',
        }
      )
      hideLoading()
      return
    }
    hideLoading()
    toast.error("Failed to add enquiry")
    return
  }

  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-semibold">{backdated ? "Back Date Add Enquiry" : "Add Enquiry"}</h1>
        <p className="text-muted-foreground text-sm">Fields marked with <span className="text-destructive">*</span> are required</p>
      </div>
      <Separator className="" />
      {backdated && <BackdateBanner what="enquiries received" />}
      {backdated && (
        <div className="space-y-2">
          <Label>Date of the enquiry</Label>
          <DatePickerDemo defaultDate={enquiryDate} onDateChange={setEnquiryDate} />
        </div>
      )}
      <div className="space-y-2">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Name"
          type="text"
          required
          value={formState.name}
          onChange={(e) => handleInputChange(capitalizeWords(e.target.value), "name")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Phone <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="10 digit mobile number"
          type="tel"
          required
          value={formState.phone ? formState.phone.toString() : ''}
          onChange={(e) => handleInputChange(Number(e.target.value.replace(/\D/g, '')), "phone")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Follow up date <span className="text-destructive">*</span>
        </Label>
        <DatePickerDemo
          key={formKey}
          onDateChange={(e) => handleInputChange(e, "followupDate")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Message
        </Label>
        <Input
          placeholder="Message"
          type="text"
          required
          value={formState.message}
          onChange={(e) => handleInputChange(e.target.value, "message")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Enquiry Type
        </Label>
        <ItemSelector key={formKey} placeholder="Enquiry Type" searchPlaceholder="Enquiry Type" data={types} labelKey="label" valueKey="value" onSelect={(e: string) => handleInputChange(String(e), "type")} />
      </div>
      <div className="space-y-2">
        <Label>
          Assign to trainer
        </Label>
        <TrainerSelect
          value={formState.trainer_id}
          onChange={(trainerId) => setFormState((prev) => ({ ...prev, trainer_id: trainerId ?? undefined }))}
        />
        <p className="text-muted-foreground text-sm">They get the enquiry's details on WhatsApp and a reminder on the follow-up date.</p>
      </div>
      <Button className="w-full md:w-fit px-8" onClick={handleOnSubmit}>
        Create
      </Button>
    </div>
  )
}

export default page


const types = [
  {
    label: "Walkin",
    value: "walkin"
  },
  {
    label: "Call",
    value: "call"
  },
  {
    label: "Instagram",
    value: "instagram"
  },
  {
    label: "Whatsapp",
    value: "whatsapp"
  }
]

// call
// walkin
// instagram
// whatsapp