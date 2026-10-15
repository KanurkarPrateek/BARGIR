"use server";

import prisma, { requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { safe } from "@/lib/safe-action";
import { commandFor, queueForAllMachines, restoreToMachines } from "@/lib/biometric-commands";
import { differenceInCalendarDays, format, startOfDay } from "date-fns";
import { DORMANT_AFTER_DAYS } from "@/lib/membership";
import {
  MembershipStatus,
  PaymentMode,
  membershipStatus,
  parseDate,
  saleDue,
} from "@/lib/membership";

export interface MemberProfile {
  id: string;
  name: string;
  memberCode: string;
  phone: string;
  email: string | null;
  address: string | null;
  gender: string;
  DOB: string;
  DOJ: string;
  biometricId: string | null;
  machineBlocked: boolean;
  blacklisted: boolean;
  blacklistReason: string | null;
  batch_id: string | null;
  trainer: { id: string; name: string } | null;
  membership: MembershipStatus;
  totalBilled: number;
  totalPaid: number;
  totalDue: number;
  sales: {
    id: string;
    service_id: string;
    service_name: string;
    trainer_name: string | null;
    startDate: string;
    endDate: string;
    amount: number;
    discount: number;
    paid: number;
    due: number;
  }[];
  payments: {
    id: string;
    service_name: string;
    amount: number;
    mode: PaymentMode;
    date: string;
    note: string | null;
  }[];
  attendanceCount: number;
  recentAttendance: { id: string; date: string; time: string }[];
}

// Everything the owner wants to see about one member, in one call.
export async function GetMemberProfile(id: string): Promise<MemberProfile | null> {
  const member = await prisma.member.findUnique({
    where: { id },
    include: {
      trainer: { select: { id: true, name: true } },
      sales: {
        include: {
          service: { select: { name: true } },
          trainer: { select: { name: true } },
        },
      },
      payments: {
        include: { sale: { select: { service: { select: { name: true } } } } },
        orderBy: { createdAt: "desc" },
      },
      attendance: true,
    },
  });
  if (!member) return null;

  // Stored dates are text, so order by the real date here.
  const byDateDesc = <T extends { date: string }>(rows: T[]) =>
    [...rows].sort((a, b) => parseDate(b.date).getTime() - parseDate(a.date).getTime());
  const sales = [...member.sales].sort(
    (a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime()
  );

  return {
    id: member.id,
    name: member.name,
    memberCode: member.memberCode,
    phone: member.phone.toString(),
    email: member.email,
    address: member.address,
    gender: member.gender,
    DOB: member.DOB,
    DOJ: member.DOJ,
    biometricId: member.biometricId,
    machineBlocked: member.machineBlocked,
    blacklisted: member.blacklisted,
    blacklistReason: member.blacklistReason,
    batch_id: member.batch_id,
    trainer: member.trainer,
    membership: membershipStatus(sales),
    totalBilled: sales.reduce((sum, sale) => sum + sale.amount - sale.discount, 0),
    totalPaid: sales.reduce((sum, sale) => sum + sale.paid, 0),
    totalDue: sales.reduce((sum, sale) => sum + saleDue(sale), 0),
    sales: sales.map((sale) => ({
      id: sale.id,
      service_id: sale.service_id,
      service_name: sale.service.name,
      trainer_name: sale.trainer?.name ?? null,
      startDate: sale.startDate,
      endDate: sale.endDate,
      amount: sale.amount,
      discount: sale.discount,
      paid: sale.paid,
      due: saleDue(sale),
    })),
    payments: byDateDesc(member.payments).map((payment) => ({
      id: payment.id,
      service_name: payment.sale.service.name,
      amount: payment.amount,
      mode: payment.mode,
      date: payment.date,
      note: payment.note,
    })),
    attendanceCount: member.attendance.length,
    recentAttendance: byDateDesc(member.attendance)
      .slice(0, 30)
      .map(({ id, date, time }) => ({ id, date, time })),
  };
}

export interface MemberListRow {
  id: string;
  memberCode: string;
  name: string;
  phone: string;
  plan: string;
  status: string;
  state: MembershipStatus["state"];
  daysLeft: number | null;
  due: number;
  dueLabel: string;
  trainer: string;
  batch: string;
  batch_id: string | null;
  lastVisit: string | null;
  // Days since the last visit; null when they have never come.
  daysAway: number | null;
  // Active membership but not seen for DORMANT_AFTER_DAYS or more.
  dormant: boolean;
  blacklisted: boolean;
  biometricId: string | null;
  machineBlocked: boolean;
  reviewDone: boolean;
}

// One row per member for the members list, with the things an owner scans
// for: what plan they are on, whether it is running, what they owe and when
// they last came.
export async function GetMemberList(): Promise<MemberListRow[]> {
  const members = await prisma.member.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      trainer: { select: { name: true } },
      batch: { select: { name: true } },
      sales: { include: { service: { select: { name: true } } } },
      attendance: { select: { date: true } },
    },
  });
  const today = startOfDay(new Date());

  return members.map((member) => {
    const membership = membershipStatus(member.sales);
    const latest = member.sales.find((sale) => sale.endDate === membership.endDate);
    const due = member.sales.reduce((sum, sale) => sum + saleDue(sale), 0);
    const lastVisitDate = member.attendance
      .map((a) => parseDate(a.date))
      .reduce<Date | null>((a, b) => (!a || b > a ? b : a), null);
    const daysAway = lastVisitDate ? differenceInCalendarDays(today, lastVisitDate) : null;
    const active = membership.state === "active" || membership.state === "expiring";
    return {
      id: member.id,
      memberCode: member.memberCode,
      name: member.name,
      phone: member.phone.toString(),
      plan: latest?.service.name ?? "-",
      status:
        membership.state === "none"
          ? "No plan"
          : membership.state === "expired"
            ? `Expired ${membership.endDate}`
            : `Till ${membership.endDate}`,
      state: membership.state,
      daysLeft: membership.daysLeft,
      due,
      dueLabel: due > 0 ? `₹${due}` : "-",
      trainer: member.trainer?.name ?? "-",
      batch: member.batch?.name ?? "-",
      batch_id: member.batch_id,
      lastVisit: lastVisitDate ? format(lastVisitDate, "dd-MM-yyyy") : null,
      daysAway,
      dormant: active && (daysAway === null ? differenceInCalendarDays(today, parseDate(member.DOJ)) >= DORMANT_AFTER_DAYS : daysAway >= DORMANT_AFTER_DAYS),
      blacklisted: member.blacklisted,
      biometricId: member.biometricId,
      machineBlocked: member.machineBlocked,
      reviewDone: member.reviewDone,
    };
  });
}

// BlackList Member: refused at check-in and taken off the biometric machines.
// Un-blacklisting puts them back on the machines if their plan is running.
export async function SetBlacklist(member_id: string, blacklisted: boolean, reason?: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    const member = await prisma.member.update({
      where: { id: member_id },
      data: { blacklisted, blacklistReason: blacklisted ? reason?.trim() || null : null },
      include: { sales: { select: { endDate: true } } },
    });
    if (blacklisted && member.biometricId && !member.machineBlocked) {
      await queueForAllMachines(`BlackList: remove ${member.name} (ID ${member.biometricId})`, commandFor.removeUser(member.biometricId));
      await prisma.member.update({ where: { id: member.id }, data: { machineBlocked: true } });
    }
    if (!blacklisted && membershipStatus(member.sales).state !== "expired") {
      await restoreToMachines(member.id);
    }
  });
}
