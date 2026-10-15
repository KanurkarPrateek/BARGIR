import prisma from "@/lib/tenant";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { DORMANT_AFTER_DAYS, membershipStatus, parseDate } from "@/lib/membership";
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

  // BlackList members never get offers.
  const members = await prisma.member.findMany({
    where: { blacklisted: false },
    select: { name: true, phone: true, DOJ: true, sales: { select: { endDate: true } }, attendance: { select: { date: true } } },
  });

  if (audience !== "enquiries") {
    const today = startOfDay(new Date());
    for (const member of members) {
      const status = membershipStatus(member.sales);
      const active = status.state === "active" || status.state === "expiring";
      if (audience === "active_members" && !active) continue;
      if (audience === "expired_members" && active) continue;
      if (audience === "renewal_due" && !(status.state === "expiring" || (status.state === "expired" && (status.daysLeft ?? -999) >= -30))) continue;
      if (audience === "dormant") {
        const last = member.attendance.map((a) => parseDate(a.date)).reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);
        const away = differenceInCalendarDays(today, last ?? parseDate(member.DOJ));
        if (!active || away < DORMANT_AFTER_DAYS) continue;
      }
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
