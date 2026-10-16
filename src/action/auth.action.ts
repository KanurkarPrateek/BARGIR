"use server";

// The old member portal is switched off (see src/app/user/layout.tsx): it
// signed members in with a shared default password, across all gyms. These
// stay only so old browser tabs get a clean "no".

export async function LoginMember(_: { phone: string; password: string }) {
  return { success: false as const };
}

export async function ChangePassword(_: { oldPassword: string; newPassword: string; member_id: string }) {
  return { success: false as const };
}
