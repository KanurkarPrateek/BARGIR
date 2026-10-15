// Starter workflows every new gym begins with; they can edit or delete them.
import base from "@/lib/prisma";

export const DEFAULTS = [
  {
    name: "Welcome a new enquiry",
    trigger: "enquiry_created" as const,
    offsetDays: 0,
    template:
      "Hi {first_name}, thanks for your interest in {gym}! 💪\n\nWe'd love to show you around. Reply here with any questions about plans, timings or trainers and we'll get right back to you.",
  },
  {
    name: "Enquiry follow-up",
    trigger: "enquiry_followup" as const,
    offsetDays: 0,
    template:
      "Hi {first_name}, this is {gym} following up on your enquiry. Have you had a chance to think about joining? Reply here and we'll help you pick the right plan.",
  },
  {
    name: "Membership expiring in 3 days",
    trigger: "membership_expiry" as const,
    offsetDays: -3,
    template:
      "Hi {first_name}, your {service} membership at {gym} ends on {expiry_date}. Renew before then to keep your streak going! Reply here and we'll sort it out for you.",
  },
  {
    name: "Membership expired",
    trigger: "membership_expiry" as const,
    offsetDays: 1,
    template:
      "Hi {first_name}, your {service} membership at {gym} ended on {expiry_date}. We miss you already! Reply here to renew and pick up where you left off.",
  },
  {
    name: "Birthday wish",
    trigger: "birthday" as const,
    offsetDays: 0,
    template:
      "Happy birthday, {first_name}! 🎉 Wishing you a strong and healthy year ahead. — Team {gym}",
  },
  {
    name: "Invoice when a plan is sold",
    trigger: "sale_created" as const,
    offsetDays: 0,
    template:
      "Hi {first_name}, thank you for joining {gym}! 🙏\n\nPlan: {service}\nAmount: {amount}\nPaid: {paid}\nBalance: {due}\nValid till: {expiry_date}\n\nYour invoice: {invoice_link}",
  },
  {
    name: "Receipt when a payment is collected",
    trigger: "payment_received" as const,
    offsetDays: 0,
    template:
      "Hi {first_name}, we received {paid} for your {service} at {gym}. Balance: {due}.\n\nInvoice: {invoice_link}\n\nThank you!",
  },
];

export async function createDefaultWorkflows(gym_id: string): Promise<void> {
  await base.whatsappWorkflow.createMany({
    data: DEFAULTS.map((workflow) => ({ ...workflow, gym_id })),
  });
}
