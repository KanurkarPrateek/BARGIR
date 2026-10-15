// WhatsApp messages to the gym's own trainers (as opposed to customers).
import prisma, { currentGymName } from "@/lib/tenant";
import { format } from "date-fns";
import { enqueue } from "./queue";


interface Lead {
  id: string;
  name: string;
  phone: bigint;
  message?: string | null;
  followupDate?: string | null;
  trainer_id?: string | null;
}

async function activeTrainer(id?: string | null) {
  if (!id) return null;
  const trainer = await prisma.trainer.findUnique({ where: { id } });
  return trainer?.active ? trainer : null;
}

// Assignment notices carry no dedupe key: each one is a deliberate action by
// the admin, and a trainer handed someone back should hear about it again.
export async function notifyTrainerOfEnquiry(enquiry: Lead): Promise<void> {
  const trainer = await activeTrainer(enquiry.trainer_id);
  if (!trainer) return;
  await enqueue([
    {
      name: trainer.name,
      phone: trainer.phone,
      body: [
        `${await currentGymName()}: a new enquiry is assigned to you.`,
        "",
        `Name: ${enquiry.name}`,
        `Phone: ${enquiry.phone}`,
        enquiry.message ? `Note: ${enquiry.message}` : null,
        enquiry.followupDate ? `Follow up on: ${enquiry.followupDate}` : null,
      ]
        .filter((line) => line !== null)
        .join("\n"),
    },
  ]);
}

export async function notifyTrainerOfMember(member: {
  id: string;
  name: string;
  phone: bigint;
  trainer_id?: string | null;
}): Promise<void> {
  const trainer = await activeTrainer(member.trainer_id);
  if (!trainer) return;
  await enqueue([
    {
      name: trainer.name,
      phone: trainer.phone,
      body: `${await currentGymName()}: ${member.name} (${member.phone}) is now your client.`,
    },
  ]);
}

// One message per trainer listing the enquiries they need to follow up today.
export async function sendTrainerFollowupReminders(): Promise<number> {
  const today = format(new Date(), "dd-MM-yyyy");
  const enquiries = await prisma.enquiry.findMany({
    where: {
      followupDate: today,
      status: { in: ["open", "trial"] },
      trainer: { active: true },
    },
    include: { trainer: true },
    orderBy: { createdAt: "asc" },
  });

  const gym = await currentGymName();
  const byTrainer = new Map<string, typeof enquiries>();
  for (const enquiry of enquiries) {
    const list = byTrainer.get(enquiry.trainer_id!) ?? [];
    list.push(enquiry);
    byTrainer.set(enquiry.trainer_id!, list);
  }

  return enqueue(
    [...byTrainer.values()].map((list) => ({
      name: list[0].trainer!.name,
      phone: list[0].trainer!.phone,
      body: [
        `${gym}: enquiries to follow up today`,
        "",
        ...list.map((enquiry) => `• ${enquiry.name} – ${enquiry.phone}`),
      ].join("\n"),
      dedupeKey: `trainer-followups:${list[0].trainer_id}:${today}`,
    }))
  );
}
