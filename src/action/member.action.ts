"use server";

import { queueGroupAdd } from "@/lib/whatsapp/group";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";
import prisma, { requireOwnTrainer } from "@/lib/tenant";
import {
  format,
  parse,
  isValid,
  isToday,
  startOfDay,
  endOfDay,
  isWithinInterval,
  differenceInYears,
} from "date-fns";
import { SalesResponse } from "./sales.action";
import { notifyTrainerOfMember } from "@/lib/whatsapp/staff";
import { requireIndianMobile } from "@/lib/phone";
import { constants } from "buffer";
// import { Gender } from '@prisma/client';
type Gender = "male" | "female" | "other";
// Type definitions
export interface MemberInput {
  name: string;
  email?: string;
  memberCode: string;
  phone: number;
  address?: string;
  DOB: string; // Format: dd-MM-yyyy
  gender: Gender;
  DOJ: string; // Format: dd-MM-yyyy
  trainer_id?: string | null;
  // Enquiry this member came from; it is marked as joined.
  enquiry_id?: string;
  // An existing member being entered later: nobody is messaged.
  backdated?: boolean;
  batch_id?: string | null;
}

export interface MemberResponse {
  id: string;
  name: string;
  email?: string | null;
  memberCode: string;
  phone: bigint;
  address?: string | null;
  DOB: string;
  gender: Gender;
  DOJ: string;
  createdAt: Date;
  updatedAt: Date;
}

// Helper function to validate date format
const validateDateFormat = (dateStr: string): boolean => {
  const parsed = parse(dateStr, "dd-MM-yyyy", new Date());
  return isValid(parsed);
};


// 1. AddMember
async function generateUniqueMemberCode(): Promise<string> {
  let memberCode: string;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 10;

  while (!isUnique && attempts < maxAttempts) {
    // Generate a random number between 1 and 999999
    const randomNum = Math.floor(Math.random() * 999999) + 1;
    // Format the number with leading zeros to make it 7 digits
    memberCode = `MEM${randomNum.toString().padStart(7, "0")}`;

    // Check if the code already exists
    const existingMember = await prisma.member.findUnique({
      where: { memberCode },
    });

    if (!existingMember) {
      isUnique = true;
    }

    attempts++;
  }

  if (!isUnique) {
    throw new UserError(
      "Failed to generate a unique member code after several attempts"
    );
  }

  return memberCode!;
}

export async function AddMember(data: MemberInput): Promise<MemberResponse | Failed> {
  return safe(async () => {
    try {
      // Validate inputs (remove memberCode from required fields)
      if (!data.name || !data.phone || !data.DOB || !data.DOJ || !data.gender) {
        throw new UserError("Missing required fields");
      }

      const phone = requireIndianMobile(data.phone);

      if (!validateDateFormat(data.DOB) || !validateDateFormat(data.DOJ)) {
        throw new UserError("Invalid date format. Use dd-MM-yyyy");
      }

      await requireOwnTrainer(data.trainer_id);

      // Generate unique member code
      const memberCode = await generateUniqueMemberCode();

      const member = await prisma.member.create({
        data: {
          name: data.name,
          email: data.email,
          memberCode, // Use the generated code
          phone,
          address: data.address,
          DOB: data.DOB,
          gender: data.gender,
          DOJ: data.DOJ,
          trainer_id: data.trainer_id || null,
          batch_id: data.batch_id || null,
        },
      });

      if (data.enquiry_id) {
        await prisma.enquiry.update({
          where: { id: data.enquiry_id },
          data: { status: "joined" },
        });
      }
      if (!data.backdated) await notifyTrainerOfMember(member).catch((error) =>
        console.error("Failed to notify trainer:", error)
      );
      if (!data.backdated) await queueGroupAdd(member, { automatic: true }).catch((error) =>
        console.error("Failed to queue the WhatsApp group add:", error)
      );

      return {
        ...member,
        email: member.email ?? undefined,
        address: member.address ?? undefined,
      };
    } catch (error: any) {
      throw error;
    }
  });
}

// 2. GetMemberById
export async function GetMemberById(
  id: string
): Promise<MemberResponse | null> {
  try {
    const member = await prisma.member.findUnique({
      where: { id },
    });

    if (!member) {
      return null;
    }

    return {
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    };
  } catch (error: any) {
    throw error;
  }
}

// 4. GetAllMembers
export async function GetAllMembers(): Promise<MemberResponse[]> {
  try {
    const members = await prisma.member.findMany({
      orderBy: { createdAt: "desc" },
    });
    return members.map((member: any) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw error;
  }
}

// 5. GetAllActiveMembers
// export async function GetAllActiveMembers(): Promise<MemberResponse[]> {
//   try {
//     const today = format(new Date(), "dd-MM-yyyy");
//     const members = await prisma.member.findMany({
//       where: {
//         sales: {
//           some: {
//             startDate: { lte: today },
//             endDate: { gte: today },
//           },
//         },
//       },
//       orderBy: { createdAt: "desc" },
//     });

//     return members.map((member: any) => ({
//       ...member,
//       email: member.email ?? undefined,
//       address: member.address ?? undefined,
//     }));
//   } catch (error: any) {
//     throw error;
//   }
// }

// 6. UpdateMemberById
export async function UpdateMemberById(
  id: string,
  data: Partial<MemberInput>
): Promise<MemberResponse | Failed> {
  return safe(async () => {
    try {
      // Validate inputs
      // The edit form sends the phone as typed text.
      const phone =
        data.phone === undefined ? undefined : requireIndianMobile(data.phone);

      if (data.DOB && !validateDateFormat(data.DOB)) {
        throw new UserError("Invalid DOB format. Use dd-MM-yyyy");
      }

      if (data.DOJ && !validateDateFormat(data.DOJ)) {
        throw new UserError("Invalid DOJ format. Use dd-MM-yyyy");
      }

      if (data.memberCode) {
        const existingMember = await prisma.member.findUnique({
          where: { memberCode: data.memberCode },
        });
        if (existingMember && existingMember.id !== id) {
          throw new UserError("Member code already exists");
        }
      }

      const member = await prisma.member.update({
        where: { id },
        data: {
          name: data.name,
          email: data.email,
          memberCode: data.memberCode,
          phone,
          address: data.address,
          DOB: data.DOB,
          gender: data.gender,
          DOJ: data.DOJ,
        },
      });

      return {
        ...member,
        email: member.email ?? undefined,
        address: member.address ?? undefined,
      };
    } catch (error: any) {
      throw error;
    }
  });
}

export async function GetMembersWithDOB(
  date: string
): Promise<MemberResponse[]> {
  try {
    const SlicedDate = date.slice(0, 5);
    const members = await prisma.member.findMany({
      where: {
        DOB: {
          contains: SlicedDate,
        },
      },
    });
    return members.map((member: any) => ({
      ...member,
      email: member.email ?? undefined,
      address: member.address ?? undefined,
    }));
  } catch (error: any) {
    throw error;
  }
}

export async function updateReviewStatus(member_id: string, status: boolean) {
  console.log(member_id, status);
  try {
    const members = await prisma.member.update({
      where: {
        id: member_id,
      },
      data: {
        reviewDone: status,
      },
    })
    console.log(members);
    return {
      success: true
    }
  } catch (error: any) {
    return {
      success: false
    }
  }
}