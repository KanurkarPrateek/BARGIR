// Called every few minutes by the WhatsApp sender service (and once a day by
// Vercel Cron as a safety net). It works out which automatic messages are due
// for every gym and puts them in the queue; the sender delivers them.
import base from "@/lib/prisma";
import { runAsGym } from "@/lib/tenant";
import { autoBlockExpiredMembers } from "@/lib/biometric-commands";
import { nudgeSender } from "@/lib/whatsapp/client";
import { sendTrainerFollowupReminders } from "@/lib/whatsapp/staff";
import { runScheduledWorkflows } from "@/lib/whatsapp/workflows";
import { NextRequest } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Same window the customer workflows use.
const isDaytime = () => {
  const hour = new Date().getHours();
  return hour >= 9 && hour < 21;
};

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const gyms = await base.gym.findMany({ where: { active: true }, select: { id: true } });
  let queued = 0;
  for (const gym of gyms) {
    try {
      queued += await runAsGym(gym.id, async () => {
        const workflows = await runScheduledWorkflows();
        const reminders = isDaytime() ? await sendTrainerFollowupReminders() : 0;
        await autoBlockExpiredMembers();
        return workflows + reminders;
      });
    } catch (error) {
      // One gym's problem must not stop the others.
      console.error(`Cron tick failed for gym ${gym.id}:`, error);
    }
  }

  // Also wakes the sender if it had gone to sleep.
  await nudgeSender();
  return Response.json({ gyms: gyms.length, queued });
}
