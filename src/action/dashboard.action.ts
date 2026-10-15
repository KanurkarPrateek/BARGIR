"use server";

import prisma from "@/lib/tenant";
import { membershipStatus, saleDue, todayString } from "@/lib/membership";
import { format } from "date-fns";

export interface DashboardSummary {
  collectedToday: number;
  collectedThisMonth: number;
  billedThisMonth: number;
  totalDue: number;
  membersWithDues: number;
  activeMembers: number;
  totalMembers: number;
  presentToday: number;
  openEnquiries: number;
  followupsToday: number;
  expiring: { id: string; name: string; phone: string; endDate: string; daysLeft: number }[];
  recentlyExpired: { id: string; name: string; phone: string; endDate: string; daysLeft: number }[];
}

// How far back an expired member still shows up as worth chasing.
const RECENTLY_EXPIRED_DAYS = 30;

export async function GetDashboardSummary(): Promise<DashboardSummary> {
  const today = todayString();
  const thisMonth = format(new Date(), "-MM-yyyy");

  const [members, sales, payments, presentToday, openEnquiries, followupsToday] =
    await Promise.all([
      prisma.member.findMany({
        select: { id: true, name: true, phone: true, sales: { select: { endDate: true } } },
      }),
      prisma.sales.findMany({
        select: { member_id: true, amount: true, discount: true, paid: true, startDate: true },
      }),
      prisma.payment.findMany({
        where: { date: { endsWith: thisMonth } },
        select: { amount: true, date: true },
      }),
      prisma.attendance.count({ where: { date: today } }),
      prisma.enquiry.count({ where: { status: { in: ["open", "trial"] } } }),
      prisma.enquiry.count({
        where: { followupDate: today, status: { in: ["open", "trial"] } },
      }),
    ]);

  const statuses = members.map((member) => ({
    id: member.id,
    name: member.name,
    phone: member.phone.toString(),
    ...membershipStatus(member.sales),
  }));
  const byDaysLeft = (a: { daysLeft: number | null }, b: { daysLeft: number | null }) =>
    (a.daysLeft ?? 0) - (b.daysLeft ?? 0);
  const pick = (member: (typeof statuses)[number]) => ({
    id: member.id,
    name: member.name,
    phone: member.phone,
    endDate: member.endDate!,
    daysLeft: member.daysLeft!,
  });

  const dueSales = sales.filter((sale) => saleDue(sale) > 0);

  return {
    collectedToday: payments
      .filter((payment) => payment.date === today)
      .reduce((sum, payment) => sum + payment.amount, 0),
    collectedThisMonth: payments.reduce((sum, payment) => sum + payment.amount, 0),
    billedThisMonth: sales
      .filter((sale) => sale.startDate.endsWith(thisMonth))
      .reduce((sum, sale) => sum + sale.amount - sale.discount, 0),
    totalDue: dueSales.reduce((sum, sale) => sum + saleDue(sale), 0),
    membersWithDues: new Set(dueSales.map((sale) => sale.member_id)).size,
    activeMembers: statuses.filter((m) => m.state === "active" || m.state === "expiring").length,
    totalMembers: members.length,
    presentToday,
    openEnquiries,
    followupsToday,
    expiring: statuses.filter((m) => m.state === "expiring").sort(byDaysLeft).map(pick),
    recentlyExpired: statuses
      .filter((m) => m.state === "expired" && m.daysLeft! >= -RECENTLY_EXPIRED_DAYS)
      .sort(byDaysLeft)
      .reverse()
      .map(pick),
  };
}
