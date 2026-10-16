import prisma, { currentGymName } from "@/lib/tenant";
import { addDays, format, isLeapYear, parse, startOfDay } from "date-fns";
import { appUrl } from "@/lib/app-url";
import { rupees, saleDue } from "@/lib/membership";
import { renderTemplate, withoutInvoiceLink } from "./constants";
import { invoicePdfUrl } from "@/lib/invoice-pdf";
import { offerSentence } from "@/lib/offers";
import { OutgoingMessage, enqueue } from "./queue";

const DATE_FORMAT = "dd-MM-yyyy";

// Scheduled messages only go out during the day.
const SEND_FROM_HOUR = 9;
const SEND_UNTIL_HOUR = 21;

// How many days back to pick up messages missed while the server was off.
const CATCH_UP_DAYS = 2;

export function personValues(name: string, gym: string) {
  return { name, first_name: name.trim().split(/\s+/)[0], gym };
}

// Fires the "new enquiry" workflows for one enquiry.
export async function runEnquiryCreatedWorkflows(enquiry: {
  id: string;
  name: string;
  phone: bigint;
  followupDate?: string | null;
}): Promise<number> {
  const workflows = await prisma.whatsappWorkflow.findMany({
    where: { trigger: "enquiry_created", enabled: true },
  });
  const gym = await currentGymName();
  return enqueue(
    workflows.map((workflow) => ({
      name: enquiry.name,
      phone: enquiry.phone,
      body: renderTemplate(workflow.template, {
        ...personValues(enquiry.name, gym),
        followup_date: enquiry.followupDate ?? "",
      }),
      dedupeKey: `${workflow.id}:${enquiry.id}`,
      workflow_id: workflow.id,
    }))
  );
}

// Fires every date based workflow that is due today. Safe to call as often
// as you like: dedupe keys make each person get each message once.
export async function runScheduledWorkflows(
  { ignoreHours = false }: { ignoreHours?: boolean } = {}
): Promise<number> {
  const hour = new Date().getHours();
  if (!ignoreHours && (hour < SEND_FROM_HOUR || hour >= SEND_UNTIL_HOUR)) {
    return 0;
  }

  const workflows = await prisma.whatsappWorkflow.findMany({
    where: {
      enabled: true,
      trigger: { in: ["enquiry_followup", "membership_expiry", "birthday"] },
    },
  });
  const today = startOfDay(new Date());
  const gym = await currentGymName();
  const messages: OutgoingMessage[] = [];

  for (const workflow of workflows) {
    // Birthdays only make sense on the day; everything else is still worth
    // sending a day or two late if the server was off.
    const lookback = workflow.trigger === "birthday" ? 0 : CATCH_UP_DAYS;

    for (let late = 0; late <= lookback; late++) {
      // The workflow sends on (event date + offset), so the events due on a
      // given day are the ones dated (that day - offset).
      const eventDay = addDays(today, -workflow.offsetDays - late);
      const eventDate = format(eventDay, DATE_FORMAT);

      if (workflow.trigger === "enquiry_followup") {
        const enquiries = await prisma.enquiry.findMany({
          // People who have joined or said no should not be chased.
          where: { followupDate: eventDate, status: { in: ["open", "trial"] } },
        });
        for (const enquiry of enquiries) {
          // They were just welcomed; a follow-up minutes later reads as spam.
          if (enquiry.createdAt >= today) continue;
          messages.push({
            name: enquiry.name,
            phone: enquiry.phone,
            body: renderTemplate(workflow.template, {
              ...personValues(enquiry.name, gym),
              followup_date: eventDate,
            }),
            dedupeKey: `${workflow.id}:${enquiry.id}:${eventDate}`,
            workflow_id: workflow.id,
          });
        }
      }

      if (workflow.trigger === "membership_expiry") {
        const sales = await prisma.sales.findMany({
          where: { endDate: eventDate },
          include: {
            service: true,
            member: { include: { sales: { select: { endDate: true } } } },
          },
        });
        for (const sale of sales) {
          // A later end date on any other sale means they already renewed.
          const renewed = sale.member.sales.some(
            (other) => parse(other.endDate, DATE_FORMAT, new Date()) > eventDay
          );
          if (renewed) continue;
          messages.push({
            name: sale.member.name,
            phone: sale.member.phone,
            body: renderTemplate(workflow.template, {
              ...personValues(sale.member.name, gym),
              service: sale.service.name,
              expiry_date: eventDate,
              offer: offerSentence(sale.service),
            }),
            // Per member, so two plans ending together send one reminder.
            dedupeKey: `${workflow.id}:${sale.member_id}:${eventDate}`,
            workflow_id: workflow.id,
          });
        }
      }

      if (workflow.trigger === "birthday") {
        // Born on 29 Feb: wished on 28 Feb in years without a 29th.
        const days = [eventDate.slice(0, 5)];
        if (days[0] === "28-02" && !isLeapYear(eventDay)) days.push("29-02");
        const members = await prisma.member.findMany({
          where: { OR: days.map((day) => ({ DOB: { startsWith: day } })) },
        });
        for (const member of members) {
          messages.push({
            name: member.name,
            phone: member.phone,
            body: renderTemplate(workflow.template, personValues(member.name, gym)),
            dedupeKey: `${workflow.id}:${member.id}:${eventDay.getFullYear()}`,
            workflow_id: workflow.id,
          });
        }
      }
    }
  }

  return enqueue(messages);
}

// Fires the invoice ("sale_created") or receipt ("payment_received") workflows
// for one sale. `paidNow` is the amount of the payment that triggered it;
// `key` makes the message unique so a retry cannot send it twice, and is left
// out when staff deliberately resend an invoice.
export async function runSaleWorkflows(
  trigger: "sale_created" | "payment_received",
  saleId: string,
  { paidNow, key }: { paidNow: number; key?: string }
): Promise<number> {
  const workflows = await prisma.whatsappWorkflow.findMany({
    where: { trigger, enabled: true },
  });
  if (workflows.length === 0) return 0;
  const sale = await prisma.sales.findUnique({
    where: { id: saleId },
    include: { member: true, service: { select: { name: true } } },
  });
  if (!sale) return 0;

  const gym = await currentGymName();
  const values = {
    ...personValues(sale.member.name, gym),
    service: sale.service.name,
    amount: rupees(sale.amount - sale.discount),
    paid: rupees(paidNow),
    due: rupees(saleDue(sale)),
    expiry_date: sale.endDate,
  };
  const document = invoicePdfUrl(sale.id, await appUrl());
  return enqueue(
    workflows.map((workflow) => ({
      name: sale.member.name,
      phone: sale.member.phone,
      body: renderTemplate(withoutInvoiceLink(workflow.template), values),
      document,
      dedupeKey: key ? `${workflow.id}:${key}` : undefined,
      workflow_id: workflow.id,
    }))
  );
}
