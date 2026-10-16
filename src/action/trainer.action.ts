"use server";

import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import prisma, { requireOwnTrainer, requireOwner } from "@/lib/tenant";
import { MembershipStatus, membershipStatus, parseDate } from "@/lib/membership";
import { notifyTrainerOfMember } from "@/lib/whatsapp/staff";
import { requireIndianMobile } from "@/lib/phone";
import { startOfDay } from "date-fns";
import { format } from "date-fns";

export interface TrainerInput {
  id?: string;
  name: string;
  phone: string;
  specialization?: string | null;
  active: boolean;
}

export interface TrainerResponse {
  id: string;
  name: string;
  phone: string;
  specialization: string | null;
  active: boolean;
  memberCount: number;
  openEnquiryCount: number;
}

export interface TrainerDetail extends TrainerResponse {
  members: {
    id: string;
    name: string;
    phone: string;
    membership: MembershipStatus;
    // Their current or latest personal training package, if they bought one.
    ptPackage: string | null;
    ptEndDate: string | null;
  }[];
  enquiries: {
    id: string;
    name: string;
    phone: string;
    status: string;
    followupDate: string | null;
    message: string | null;
  }[];
  // Value of packages sold under this trainer that started this month.
  salesThisMonth: number;
}

export async function GetTrainers(): Promise<TrainerResponse[]> {
  const trainers = await prisma.trainer.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      _count: {
        select: {
          members: true,
          enquiries: { where: { status: { in: ["open", "trial"] } } },
        },
      },
    },
  });
  return trainers.map(({ _count, ...trainer }) => ({
    id: trainer.id,
    name: trainer.name,
    phone: trainer.phone.toString(),
    specialization: trainer.specialization,
    active: trainer.active,
    memberCount: _count.members,
    openEnquiryCount: _count.enquiries,
  }));
}

export async function SaveTrainer(data: TrainerInput): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (!data.name.trim()) throw new UserError("Enter the trainer's name");
    const phone = requireIndianMobile(data.phone);

    const values = {
      name: data.name.trim(),
      phone,
      specialization: data.specialization?.trim() || null,
      active: data.active,
    };
    if (data.id) {
      await prisma.trainer.update({ where: { id: data.id }, data: values });
    } else {
      await prisma.trainer.create({ data: values });
    }
  });
}

// Their members and enquiries stay, just without a trainer. A trainer who has
// sold packages is kept, or the sales would lose who made them.
export async function DeleteTrainer(id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (await prisma.sales.count({ where: { trainer_id: id } })) {
      throw new UserError("This trainer has sales, so they cannot be deleted. Edit them and switch off 'Currently working here' instead.");
    }
    await prisma.trainer.delete({ where: { id } });
  });
}

// Owner only: includes the value of their sales.
export async function GetTrainerDetail(id: string): Promise<TrainerDetail | null> {
  await requireOwner();
  const trainer = await prisma.trainer.findUnique({
    where: { id },
    include: {
      members: {
        orderBy: { name: "asc" },
        include: {
          sales: { select: { endDate: true, service: { select: { name: true, isPersonalTraining: true } } } },
        },
      },
      enquiries: { orderBy: { createdAt: "desc" } },
      sales: {
        where: { startDate: { endsWith: format(new Date(), "-MM-yyyy") } },
      },
    },
  });
  if (!trainer) return null;

  return {
    id: trainer.id,
    name: trainer.name,
    phone: trainer.phone.toString(),
    specialization: trainer.specialization,
    active: trainer.active,
    memberCount: trainer.members.length,
    openEnquiryCount: trainer.enquiries.filter(
      (enquiry) => enquiry.status === "open" || enquiry.status === "trial"
    ).length,
    members: trainer.members.map((member) => {
      const pt = latestByEndDate(member.sales.filter((sale) => sale.service.isPersonalTraining));
      return {
        id: member.id,
        name: member.name,
        phone: member.phone.toString(),
        membership: membershipStatus(member.sales),
        ptPackage: pt?.service.name ?? null,
        ptEndDate: pt?.endDate ?? null,
      };
    }),
    enquiries: trainer.enquiries.map((enquiry) => ({
      id: enquiry.id,
      name: enquiry.name,
      phone: enquiry.phone.toString(),
      status: enquiry.status,
      followupDate: enquiry.followupDate,
      message: enquiry.message,
    })),
    salesThisMonth: trainer.sales.reduce(
      (sum, sale) => sum + sale.amount - sale.discount,
      0
    ),
  };
}

function latestByEndDate<T extends { endDate: string }>(sales: T[]): T | undefined {
  return [...sales].sort(
    (a, b) => parseDate(b.endDate).getTime() - parseDate(a.endDate).getTime()
  )[0];
}

export interface PtClient {
  member_id: string;
  name: string;
  phone: string;
  package: string;
  startDate: string;
  endDate: string;
  // False once the package has run out.
  active: boolean;
  trainer_id: string | null;
  trainer_name: string | null;
}

// Everyone who has bought a personal training package, with the trainer
// they are with. One row per member, for their latest package.
export async function GetPtClients(): Promise<PtClient[]> {
  const sales = await prisma.sales.findMany({
    where: { service: { isPersonalTraining: true } },
    include: {
      service: { select: { name: true } },
      trainer: { select: { id: true, name: true } },
      member: {
        select: {
          id: true,
          name: true,
          phone: true,
          trainer: { select: { id: true, name: true } },
        },
      },
    },
  });

  const byMember = new Map<string, typeof sales>();
  for (const sale of sales) {
    byMember.set(sale.member_id, [...(byMember.get(sale.member_id) ?? []), sale]);
  }

  const today = startOfDay(new Date());
  return [...byMember.values()]
    .map((memberSales) => {
      const sale = latestByEndDate(memberSales)!;
      // The member's trainer is the source of truth; the sale only remembers
      // who was chosen when it was sold.
      const trainer = sale.member.trainer ?? sale.trainer;
      return {
        member_id: sale.member.id,
        name: sale.member.name,
        phone: sale.member.phone.toString(),
        package: sale.service.name,
        startDate: sale.startDate,
        endDate: sale.endDate,
        active: parseDate(sale.endDate) >= today,
        trainer_id: trainer?.id ?? null,
        trainer_name: trainer?.name ?? null,
      };
    })
    .sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));
}

// Puts a member with a trainer (or takes them off one), on both the member
// and any personal training packages of theirs that are still running.
export async function AssignPtTrainer(
  member_id: string,
  trainer_id: string | null
): Promise<void | Failed> {
  return safe(async () => {
    await requireOwnTrainer(trainer_id);
    const member = await prisma.member.update({
      where: { id: member_id },
      data: { trainer_id },
      include: {
        sales: {
          where: { service: { isPersonalTraining: true } },
          select: { id: true, endDate: true },
        },
      },
    });

    const today = startOfDay(new Date());
    const running = member.sales
      .filter((sale) => parseDate(sale.endDate) >= today)
      .map((sale) => sale.id);
    await prisma.sales.updateMany({
      where: { id: { in: running } },
      data: { trainer_id },
    });

    await notifyTrainerOfMember(member).catch((error) =>
      console.error("Failed to notify trainer:", error)
    );
  });
}
