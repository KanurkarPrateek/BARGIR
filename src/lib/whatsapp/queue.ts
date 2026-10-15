import prisma from "@/lib/tenant";
import { nudgeSender } from "./client";

export interface OutgoingMessage {
  name: string;
  phone: bigint;
  body: string;
  dedupeKey?: string;
  workflow_id?: string;
  campaign_id?: string;
}

// Adds messages to the current gym's queue, ignoring ones already queued for
// the same event. The sender service (worker/) delivers them. Returns how
// many were added.
export async function enqueue(messages: OutgoingMessage[]): Promise<number> {
  if (messages.length === 0) return 0;
  const { count } = await prisma.whatsappMessage.createMany({
    data: messages,
    skipDuplicates: true,
  });
  if (count > 0) await nudgeSender();
  return count;
}
