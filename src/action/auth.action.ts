"use server";

import prisma from "@/lib/prisma";

export async function LoginMember({
  phone,
  password,
}: {
  phone: string;
  password: string;
}) {
  try {
    const member = await prisma.member.findFirst({
      where: {
        phone: BigInt(phone),
        password: password,
      },
    });

    if (member) {
      return { success: true, id: member.id };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
}


export async function ChangePassword({
  oldPassword,
  newPassword,
  member_id
}: {
  oldPassword: string;
  newPassword: string;
  member_id: string;
}) {
  try {
    const member = await prisma.member.findFirst({
      where: {
        id: member_id,
        password: oldPassword,
      },
    });

    if (member) {
      await prisma.member.update({
        where: {
          id: member_id,
        },
        data: {
          password: newPassword,
        },
      });
      return { success: true };
    }
    return { success: false };
  } catch {
    return { success: false };
  }
  
}
