// Starter workflows every new gym begins with; they can edit or delete them.
import base from "@/lib/prisma";
import { WORKFLOW_TEMPLATES } from "./messages";

export const DEFAULTS = [
  {
    name: "Welcome a new enquiry",
    trigger: "enquiry_created" as const,
    offsetDays: 0,
    template:
      WORKFLOW_TEMPLATES.welcome,
  },
  {
    name: "Enquiry follow-up",
    trigger: "enquiry_followup" as const,
    offsetDays: 0,
    template:
      WORKFLOW_TEMPLATES.enquiryFollowup,
  },
  {
    name: "Membership expiring in 3 days",
    trigger: "membership_expiry" as const,
    offsetDays: -3,
    template:
      WORKFLOW_TEMPLATES.expiringSoon,
  },
  {
    name: "Membership expired",
    trigger: "membership_expiry" as const,
    offsetDays: 1,
    template:
      WORKFLOW_TEMPLATES.expired,
  },
  {
    name: "Birthday wish",
    trigger: "birthday" as const,
    offsetDays: 0,
    template:
      WORKFLOW_TEMPLATES.birthday,
  },
  {
    name: "Invoice when a plan is sold",
    trigger: "sale_created" as const,
    offsetDays: 0,
    template:
      WORKFLOW_TEMPLATES.invoice,
  },
  {
    name: "Receipt when a payment is collected",
    trigger: "payment_received" as const,
    offsetDays: 0,
    template:
      WORKFLOW_TEMPLATES.receipt,
  },
];

export async function createDefaultWorkflows(gym_id: string): Promise<void> {
  await base.whatsappWorkflow.createMany({
    data: DEFAULTS.map((workflow) => ({ ...workflow, gym_id })),
  });
}
