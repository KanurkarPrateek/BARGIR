import prisma from "@/lib/tenant";
import { parse, startOfDay } from "date-fns";
import { CampaignAudience } from "./constants";

export interface Recipient {
  name: string;
  phone: bigint;
}

// Resolves an audience to people, one entry per phone number.
export async function getRecipients(
  audience: CampaignAudience
): Promise<Recipient[]> {
  const recipients = new Map<string, Recipient>();
  const add = (person: Recipient) => {
    const key = person.phone.toString();
    if (!recipients.has(key)) recipients.set(key, person);
  };

  const members = await prisma.member.findMany({
    select: { name: true, phone: true, sales: { select: { endDate: true } } },
  });

  if (audience !== "enquiries") {
    const today = startOfDay(new Date());
    for (const member of members) {
      const active = member.sales.some(
        (sale) => parse(sale.endDate, "dd-MM-yyyy", new Date()) >= today
      );
      if (audience === "active_members" && !active) continue;
      if (audience === "expired_members" && active) continue;
      add(member);
    }
  }

  if (audience === "enquiries" || audience === "everyone") {
    // Members are added first above, so for "everyone" their member name wins;
    // for "enquiries" people who have since joined are left out.
    const memberPhones = new Set(members.map((m) => m.phone.toString()));
    const enquiries = await prisma.enquiry.findMany({
      // People who said no are left alone.
      where: { status: { not: "lost" } },
      select: { name: true, phone: true },
      orderBy: { createdAt: "desc" },
    });
    for (const enquiry of enquiries) {
      if (audience === "enquiries" && memberPhones.has(enquiry.phone.toString())) {
        continue;
      }
      add(enquiry);
    }
  }

  return [...recipients.values()];
}
