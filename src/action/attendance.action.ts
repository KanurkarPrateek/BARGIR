'use server';

import { Failed } from '@/lib/action-result';
import { UserError, safe } from '@/lib/safe-action';
import prisma from '@/lib/tenant';
import { Prisma } from '@prisma/client';
import { format, parse, isValid, isToday } from 'date-fns';
import { membershipStatus } from '@/lib/membership';

// Type definitions
export interface AttendanceInput {
  member_id: string;
  date: string; // Format: dd-MM-yyyy
  time: string;
}

export interface AttendanceResponse {
  id: string;
  member_id: string;
  date: string;
  time: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, 'dd-MM-yyyy', new Date());
  return isValid(parsed);
};

// 1. AddAttendance
export async function AddAttendance(data: AttendanceInput): Promise<AttendanceResponse | Failed> {
  return safe(async () => {
    try {
      // Validate inputs
      if (!data.member_id || !data.date) {
        throw new UserError('Missing required fields');
      }

      if (!validateDateFormat(data.date)) {
        throw new UserError('Invalid date format. Use dd-MM-yyyy');
      }

      // Check if member exists
      const member = await prisma.member.findUnique({
        where: { id: data.member_id },
      });
      if (!member) {
        throw new UserError('Member not found');
      }
      if (member.blacklisted) {
        throw new UserError(`${member.name} is blacklisted${member.blacklistReason ? `: ${member.blacklistReason}` : ''}`);
      }

      // Check if attendance already exists for this member on this date
      const existingAttendance = await prisma.attendance.findFirst({
        where: {
          member_id: data.member_id,
          date: data.date,
        },
      });
      if (existingAttendance) {
        return existingAttendance;
      }

      // The check above can race with a machine punch or a second tap; the
      // database allows one check-in per member per day, so a clash simply
      // returns the check-in that won.
      const attendance = await prisma.attendance.create({
        data: {
          member_id: data.member_id,
          date: data.date,
          time: data.time,
        },
      }).catch(async (error) => {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
          const existing = await prisma.attendance.findFirst({ where: { member_id: data.member_id, date: data.date } });
          if (existing) return existing;
        }
        throw error;
      });

      return {
        ...attendance,
      };
    } catch (error:any) {
      throw error;
    }
  });
}

// 3. GetAttendanceByDate
export async function GetAttendanceByDate(date: string): Promise<AttendanceResponse[]> {
  try {
    if (!validateDateFormat(date)) {
      throw new UserError('Invalid date format. Use dd-MM-yyyy');
    }

    const attendances = await prisma.attendance.findMany({
      where: {
        date,
      },
      orderBy: { createdAt: 'desc' },
      include:{
        member: {
            select: {
                id: true,
                name: true,
                sales: { select: { endDate: true } },
            }
        }
      }
    });

    // Lets the front desk spot people checking in without a valid membership.
    return attendances.map(({ member, ...attendance }) => ({
      ...attendance,
      member: { id: member.id, name: member.name },
      membership: membershipStatus(member.sales),
    }));
  } catch (error:any) {
    throw error;
  }
}
