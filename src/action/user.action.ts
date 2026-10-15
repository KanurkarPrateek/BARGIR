"use server";
import prisma from "@/lib/prisma";
import { isWithinInterval, parse } from "date-fns";

export async function getAllDetailsOfMember(member_id: string) {
  try {
    const today = new Date();
    const user = await prisma.member.findUnique({
      where: { id: member_id },
      select: {
        id: true,
        name: true,
        email: true,
        memberCode: true,
        phone: true,
        address: true,
        DOB: true,
        gender: true,
        DOJ: true,
      },
    });
    const allSalesOfMember = await prisma.sales.findMany({
      where: {
        member_id: member_id,
      },
      include: {
        service: true,
      },
    });

    const activeSales = allSalesOfMember.filter((sale) => {
      const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
      const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
      return isWithinInterval(today, { start: startDate, end: endDate });
    });
    const inActiveSales = allSalesOfMember.filter((sale) => {
      const startDate = parse(sale.startDate, "dd-MM-yyyy", new Date());
      const endDate = parse(sale.endDate, "dd-MM-yyyy", new Date());
      return !isWithinInterval(today, { start: startDate, end: endDate });
    });

    const allAttendanceOfMember = await prisma.attendance.findMany({
      where: { member_id: member_id },
    });

    return { user, activeSales, inActiveSales, allAttendanceOfMember };
  } catch (error) {}
}
