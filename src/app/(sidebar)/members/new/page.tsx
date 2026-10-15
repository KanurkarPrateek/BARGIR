"use client";

import { call } from '@/lib/action-result'
import { DatePickerDemo } from "@/components/custom/date-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import React, { useEffect, useState } from "react";
import { GetEnquiryById } from "@/action/enquiries.action";
import { TrainerSelect } from "@/components/custom/trainer-select";
import { BackdateBanner } from "@/components/custom/backdate-banner";
import { BatchRow, GetBatches } from "@/action/batch.action";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { format, parse } from "date-fns";
import { AddMember, MemberInput } from "@/action/member.action";
import { toast } from "sonner"
import { PHONE_ERROR, normalizeIndianMobile } from "@/lib/phone";
import { Phone } from "lucide-react";
import { useLoading } from "@/hooks/use-loading";
import { capitalizeWords } from "@/lib/utils";
type Gender = "male" | "female" | "other";

interface FormState {
  name: string;
  phone: string;
  email: string;
  gender: string;
  DOB: string;
  DOJ: string;
  address: string;
}

const page = ({ searchParams }: { searchParams: any }) => {
  // Arriving from an enquiry: carry over what was already typed there.
  const { enquiry: enquiryId, backdate } = React.use(searchParams) as { enquiry?: string; backdate?: string };
  const backdated = backdate === "1";
  const [batches, setBatches] = useState<BatchRow[]>([]);
  useEffect(() => {
    GetBatches().then(setBatches);
  }, []);
  const { showLoading, hideLoading } = useLoading();
  const [formState, setFormState] = useState<MemberInput>({
    name: "",
    phone: 0,
    email: "",
    memberCode: "",
    gender: "other",
    DOB: "",
    DOJ: format(new Date(), "dd-MM-yyyy"),
    address: "",
  });

  useEffect(() => {
    if (!enquiryId) return;
    GetEnquiryById(enquiryId).then((enquiry) => {
      if (!enquiry) return;
      setFormState((prev) => ({
        ...prev,
        name: enquiry.name,
        phone: Number(enquiry.phone),
        trainer_id: enquiry.trainer_id,
        enquiry_id: enquiry.id,
      }));
    });
  }, [enquiryId]);

  const handleInputChange = (e: any, field: keyof FormState) => {
    setFormState((prev) => ({ ...prev, [field]: e }));
  };

  const handleGenderChange = (value: Gender) => {
    setFormState((prev) => ({ ...prev, gender: value }));
  };

  const handleOnSubmit = async () => {
    showLoading();
    if (
      formState.name === "" ||
      formState.phone === null ||
      formState.DOB === "" ||
      formState.DOJ === ""
    ) {
      toast.error("Please fill all the required fields");
      hideLoading();
      return;
    }
    if (!normalizeIndianMobile(formState.phone)) {
      toast.error(PHONE_ERROR)
      hideLoading();
      return;
    }
    console.log("Form submitted with state:", formState);
    // db operation
    const response = await call(AddMember({ ...formState, backdated })).catch((error) => {
      toast.error(error.message);
      return null;
    });
    if (!response) {
      hideLoading();
      return;
    }
    if (response.id) {
      toast.success("Member added. Now choose their plan.");
      hideLoading();
      // Joining nearly always means buying a plan, so go straight there.
      window.location.href = `/sales/new?member=${response.id}${backdated ? "&backdate=1" : ""}`;
      return;
    }
    hideLoading();
    toast.error("Failed to add member");
    return;
  };

  return (
    <div className="max-w-xl w-full mx-auto space-y-6 p-4">
      <div>
        <h1 className="text-3xl font-semibold">{backdated ? "BackDate Add Member" : "Add Member"}</h1>
        <p className="text-muted-foreground text-sm">
          Fields marked with <span className="text-destructive">*</span> are
          required
        </p>
      </div>
      <Separator className="" />
      {backdated && <BackdateBanner what="members who joined" />}
      <div className="space-y-2">
        <Label>
          Name <span className="text-destructive">*</span>
        </Label>
        <Input
          placeholder="Name"
          type="text"
          style={{
            textTransform: "capitalize",
          }}
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
          placeholder="Phone"
          type="tel"
          required
          value={formState.phone || ""}
          onChange={(e) => handleInputChange(e.target.value, "phone")}
        />
      </div>
      <div className="space-y-2">
        <Label>Email</Label>
        <Input
          placeholder="Email"
          type="email"
          value={formState.email}
          onChange={(e) => handleInputChange(e.target.value, "email")}
        />
      </div>
      <fieldset className="space-y-4">
        <legend className="text-foreground text-sm leading-none font-medium">
          Gender <span className="text-destructive">*</span>
        </legend>
        <RadioGroup
          className="flex flex-wrap gap-2"
          value={formState.gender}
          onValueChange={handleGenderChange}
        >
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="female"
                className="after:absolute after:inset-0"
              />
              <Label>Female</Label>
            </div>
          </div>
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="male"
                className="after:absolute after:inset-0"
              />
              <Label>Male</Label>
            </div>
          </div>
          <div className="border-input has-data-[state=checked]:border-primary/50 relative flex flex-col items-start gap-4 rounded-md border p-3 shadow-xs outline-none">
            <div className="flex items-center gap-2">
              <RadioGroupItem
                value="other"
                className="after:absolute after:inset-0"
              />
              <Label>Other</Label>
            </div>
          </div>
        </RadioGroup>
      </fieldset>
      <div className="space-y-2">
        <Label>
          Date of Birth <span className="text-destructive">*</span>
        </Label>
        <DatePickerDemo
          defaultDate={formState.DOB}
          onDateChange={(e) => handleInputChange(e, "DOB")}
        />
      </div>
      <div className="space-y-2">
        <Label>
          Date of Join <span className="text-destructive">*</span>
        </Label>
        <DatePickerDemo
          defaultDate={formState.DOJ}
          onDateChange={(e) => handleInputChange(e, "DOJ")}
        />
      </div>
      <div className="space-y-2">
        <Label>Address</Label>
        <Input
          placeholder="Address"
          type="text"
          value={formState.address}
          onChange={(e) => handleInputChange(e.target.value, "address")}
        />
      </div>
      {batches.length > 0 && (
        <div className="space-y-2">
          <Label>Batch</Label>
          <Select value={formState.batch_id ?? "none"} onValueChange={(v) => setFormState((prev) => ({ ...prev, batch_id: v === "none" ? null : v }))}>
            <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No batch</SelectItem>
              {batches.map((b) => <SelectItem key={b.id} value={b.id}>{b.name} ({b.startTime}–{b.endTime})</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}
      <div className="space-y-2">
        <Label>Personal trainer</Label>
        <TrainerSelect
          value={formState.trainer_id}
          onChange={(trainerId) => setFormState((prev) => ({ ...prev, trainer_id: trainerId }))}
        />
      </div>
      <Button className="w-full md:w-fit px-8" onClick={handleOnSubmit}>
        Create
      </Button>
    </div>
  );
};

export default page;
