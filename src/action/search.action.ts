"use server";

// Universal Search Member: one box at the top of every page that finds
// members (by name, phone, member ID or machine ID), enquiries, staff and
// trainers.
import prisma from "@/lib/tenant";
import { membershipStatus } from "@/lib/membership";

export interface SearchHit {
  kind: "member" | "enquiry" | "staff" | "trainer";
  id: string;
  title: string;
  detail: string;
  href: string;
  badge?: string;
}

const LIMIT = 6;

export async function UniversalSearch(query: string): Promise<SearchHit[]> {
  const q = query.trim();
  if (q.length < 2) return [];
  const digits = q.replace(/\D/g, "");
  const text = { contains: q, mode: "insensitive" as const };
  // Phone numbers are stored as numbers, so match them as text in memory.
  const phoneMatch = (phone: bigint) => digits.length >= 3 && phone.toString().includes(digits);

  const [members, enquiries, staff, trainers] = await Promise.all([
    prisma.member.findMany({
      select: { id: true, name: true, phone: true, memberCode: true, biometricId: true, blacklisted: true, sales: { select: { endDate: true } } },
    }),
    prisma.enquiry.findMany({ select: { id: true, name: true, phone: true, status: true }, orderBy: { createdAt: "desc" } }),
    prisma.staff.findMany({ where: { OR: [{ name: text }, { role: text }] }, take: LIMIT }),
    prisma.trainer.findMany({ where: { name: text }, take: LIMIT }),
  ]);
  const lower = q.toLowerCase();

  const memberHits: SearchHit[] = members
    .filter((m) =>
      m.name.toLowerCase().includes(lower) ||
      m.memberCode.toLowerCase().includes(lower) ||
      m.biometricId === q ||
      phoneMatch(m.phone)
    )
    .slice(0, LIMIT)
    .map((m) => {
      const status = membershipStatus(m.sales);
      return {
        kind: "member",
        id: m.id,
        title: m.name,
        detail: `${m.memberCode} · ${m.phone}`,
        href: `/members/${m.id}`,
        badge: m.blacklisted ? "BlackList" : status.state === "expired" ? "Expired" : status.state === "none" ? "No plan" : "Active",
      };
    });

  return [
    ...memberHits,
    ...enquiries
      .filter((e) => e.name.toLowerCase().includes(lower) || phoneMatch(e.phone))
      .slice(0, LIMIT)
      .map((e): SearchHit => ({ kind: "enquiry", id: e.id, title: e.name, detail: `Enquiry · ${e.phone}`, href: `/enquiries?q=${encodeURIComponent(e.name)}`, badge: e.status })),
    ...staff.map((s): SearchHit => ({ kind: "staff", id: s.id, title: s.name, detail: `Staff · ${s.role}`, href: "/staff" })),
    ...trainers.map((t): SearchHit => ({ kind: "trainer", id: t.id, title: t.name, detail: "Trainer", href: `/trainers/${t.id}` })),
  ];
}
