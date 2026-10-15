"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import prisma, { currentGymName, requireGymId , requireOwner } from "@/lib/tenant";
import { getRecipients } from "@/lib/whatsapp/audience";
import { Connection, disconnect, getConnection, nudgeSender } from "@/lib/whatsapp/client";
import {
  CampaignAudience,
  WorkflowTrigger,
  renderTemplate,
} from "@/lib/whatsapp/constants";
import { enqueue } from "@/lib/whatsapp/queue";
import { personValues, runScheduledWorkflows } from "@/lib/whatsapp/workflows";
import { requireIndianMobile } from "@/lib/phone";

type MessageStatus = "pending" | "sent" | "failed";

const IMMEDIATE_TRIGGERS: WorkflowTrigger[] = ["enquiry_created", "sale_created", "payment_received"];

export interface WorkflowInput {
  id?: string;
  name: string;
  trigger: WorkflowTrigger;
  offsetDays: number;
  template: string;
  enabled: boolean;
}

export interface WorkflowResponse extends WorkflowInput {
  id: string;
  sentCount: number;
}

export interface CampaignResponse {
  id: string;
  title: string;
  template: string;
  audience: CampaignAudience;
  createdAt: Date;
  counts: Record<MessageStatus, number>;
}

export interface MessageResponse {
  id: string;
  name: string;
  phone: string;
  body: string;
  status: MessageStatus;
  error: string | null;
  source: string;
  createdAt: Date;
  sentAt: Date | null;
}

// ---------- Connection ----------

export async function GetWhatsappConnection(): Promise<Connection> {
  return getConnection(await requireGymId());
}

// Unlinks the gym's WhatsApp number so a different one can be scanned.
export async function DisconnectWhatsapp(): Promise<void> {
  await requireOwner();
  await disconnect(await requireGymId());
}

export async function SendTestMessage(phone: string, message: string) {
  return safe(async () => {
    await requireOwner();
    if (!message.trim()) throw new UserError("Message is empty");
    await enqueue([{ name: "Test", phone: requireIndianMobile(phone), body: message }]);
  });
}

// ---------- Workflows ----------

export async function GetWorkflows(): Promise<WorkflowResponse[]> {
  const workflows = await prisma.whatsappWorkflow.findMany({
    orderBy: { createdAt: "asc" },
    include: { _count: { select: { messages: { where: { status: "sent" } } } } },
  });
  return workflows.map(({ _count, ...workflow }) => ({
    ...workflow,
    sentCount: _count.messages,
  }));
}

export async function SaveWorkflow(data: WorkflowInput): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (!data.name.trim()) throw new UserError("Give the workflow a name");
    if (!data.template.trim()) throw new UserError("Message cannot be empty");

    const values = {
      name: data.name.trim(),
      trigger: data.trigger,
      // Event triggers (new enquiry, sale, payment) always send immediately.
      offsetDays: IMMEDIATE_TRIGGERS.includes(data.trigger) ? 0 : Math.trunc(data.offsetDays) || 0,
      template: data.template.trim(),
      enabled: data.enabled,
    };

    if (data.id) {
      await prisma.whatsappWorkflow.update({ where: { id: data.id }, data: values });
    } else {
      await prisma.whatsappWorkflow.create({ data: values });
    }
  });
}

export async function SetWorkflowEnabled(id: string, enabled: boolean) {
  await requireOwner();
  await prisma.whatsappWorkflow.update({ where: { id }, data: { enabled } });
}

export async function DeleteWorkflow(id: string): Promise<void> {
  await requireOwner();
  await prisma.whatsappWorkflow.delete({ where: { id } });
}

// Runs every workflow that is due today right now, instead of waiting for
// the scheduler. Returns how many new messages were queued.
export async function RunWorkflowsNow(): Promise<number> {
  await requireOwner();
  return runScheduledWorkflows({ ignoreHours: true });
}

// ---------- Offers / broadcasts ----------

export async function GetAudienceSize(audience: CampaignAudience): Promise<number> {
  return (await getRecipients(audience)).length;
}

export async function SendCampaign(data: {
  title: string;
  template: string;
  audience: CampaignAudience;
}): Promise<number | Failed> {
  return safe(async () => {
    await requireOwner();
    if (!data.title.trim()) throw new UserError("Give the offer a title");
    if (!data.template.trim()) throw new UserError("Message cannot be empty");

    const recipients = await getRecipients(data.audience);
    if (recipients.length === 0) throw new UserError("Nobody matches this audience");

    const gym = await currentGymName();
    const campaign = await prisma.whatsappCampaign.create({
      data: {
        title: data.title.trim(),
        template: data.template.trim(),
        audience: data.audience,
      },
    });

    return enqueue(
      recipients.map((person) => ({
        name: person.name,
        phone: person.phone,
        body: renderTemplate(campaign.template, personValues(person.name, gym)),
        campaign_id: campaign.id,
      }))
    );
  });
}

export async function GetCampaigns(): Promise<CampaignResponse[]> {
  const [campaigns, grouped] = await Promise.all([
    prisma.whatsappCampaign.findMany({ orderBy: { createdAt: "desc" } }),
    prisma.whatsappMessage.groupBy({
      by: ["campaign_id", "status"],
      where: { campaign_id: { not: null } },
      _count: true,
    }),
  ]);

  return campaigns.map((campaign) => {
    const counts = { pending: 0, sent: 0, failed: 0 };
    for (const row of grouped) {
      if (row.campaign_id === campaign.id) counts[row.status] = row._count;
    }
    return { ...campaign, counts };
  });
}

// ---------- Message log ----------

export async function GetMessages(): Promise<MessageResponse[]> {
  const messages = await prisma.whatsappMessage.findMany({
    orderBy: { createdAt: "desc" },
    take: 200,
    include: {
      workflow: { select: { name: true } },
      campaign: { select: { title: true } },
    },
  });
  return messages.map((message) => ({
    id: message.id,
    name: message.name,
    phone: message.phone.toString(),
    body: message.body,
    status: message.status,
    error: message.error,
    source: message.workflow?.name ?? message.campaign?.title ?? "Manual",
    createdAt: message.createdAt,
    sentAt: message.sentAt,
  }));
}

// Puts failed messages back in the queue.
export async function RetryFailedMessages(): Promise<number> {
  await requireOwner();
  const { count } = await prisma.whatsappMessage.updateMany({
    where: { status: "failed" },
    data: { status: "pending", error: null, createdAt: new Date() },
  });
  await nudgeSender();
  return count;
}
