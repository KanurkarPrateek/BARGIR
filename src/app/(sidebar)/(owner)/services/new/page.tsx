"use client"

import { call } from '@/lib/action-result'
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Separator } from "@/components/ui/separator"
import React, { useState } from "react"

import { toast } from "sonner"

import {  AddService, ServiceInput } from "@/action/service.action"



const page = () => {
  const [formState, setFormState] = useState<ServiceInput>({
    name: "",
    description: "",
    price: 0,
    duration: 0,
    isPersonalTraining: false
  })

  const handleInputChange = (
    e: any,
    field: keyof ServiceInput
  ) => {
    setFormState((prev) => ({ ...prev, [field]: e }))
  }


  const handleOnSubmit = async () => {
    // console.log(formState)
    if(formState.name === "" || formState.price === null || formState.duration === null) {
      toast.error("Please fill all the required fields")
      return
    }
    if(formState.price <= 0 || formState.duration <= 0) {
      toast.error("Price and duration must be greater than zero")
      return
    }
    
    // console.log("Form submitted with state:", formState)
    // db operation
    const response = await call(AddService(formState)).catch((error) => {
      toast.error(error.message)
      return null
    })
    if(response?.id){
      setFormState({
        name: "",
        description: "",
        price: 0,
        duration: 0
      })
      toast.success("Service added successfully")
    }
  }

  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div>
      <h1 className="text-3xl font-semibold">Add Package</h1>
      <p className="text-muted-foreground text-sm">Fields marked with <span className="text-destructive">*</span> are required</p>
      </div>
      <Separator className="" />
      <div className="space-y-2">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Name"
          type="text"
          required
          value={formState.name}
          onChange={(e) => handleInputChange(e.target.value, "name")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Description 
        </Label>
        <Input
          placeholder="Description"
          type="tel"
          required
          value={formState.description}
          onChange={(e) => handleInputChange(e.target.value, "description")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Price <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Price"
          type="number"
          value={formState.price}
          onChange={(e) => handleInputChange(e.target.value, "price")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Duration in months <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Duration"
          type="number"
          value={formState.duration}
          onChange={(e) => handleInputChange(e.target.value, "duration")}
        />
      </div>
      <div className="flex items-center justify-between gap-4 rounded-lg border p-3">
        <div>
          <Label>Personal training package</Label>
          <p className="text-muted-foreground text-sm">Members who buy this are tracked as PT clients and matched to a trainer.</p>
        </div>
        <Switch
          checked={!!formState.isPersonalTraining}
          onCheckedChange={(checked) => handleInputChange(checked, "isPersonalTraining")}
        />
      </div>
      <Button className="w-full md:w-fit px-8" onClick={handleOnSubmit}>
        Create
      </Button>
    </div>
  )
}

export default page