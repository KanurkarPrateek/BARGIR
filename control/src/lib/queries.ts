// Reads shared by several pages.
import type { Plan, User } from "@prisma/client";
import { startOfMonth } from "date-fns";
import { db } from "./db";
import { clusterGyms, clusterStatus, type ClusterStatus, type RemoteGym } from "./cluster-api";
import { daysUntil, monthlyValue } from "./business";

// Salespeople only ever see the gyms they sold.
export const gymScope = (user: User) => (user.role === "admin" ? {} : { salesperson_id: user.id });

export async function commissionSummary(userId: string) {
  const [earned, paid, thisMonth] = await Promise.all([
    db.payment.aggregate({ where: { salesperson_id: userId }, _sum: { commission: true } }),
    db.payout.aggregate({ where: { user_id: userId }, _sum: { amount: true } }),
    db.payment.aggregate({ where: { salesperson_id: userId, date: { gte: startOfMonth(new Date()) } }, _sum: { commission: true } }),
  ]);
  const e = earned._sum.commission ?? 0, p = paid._sum.amount ?? 0;
  return { earned: e, paid: p, owed: e - p, thisMonth: thisMonth._sum.commission ?? 0 };
}

export function businessNumbers<G extends { status: string; price: number; plan: Plan; renewalDate: Date }>(gyms: G[]) {
  const live = gyms.filter((g) => g.status === "active");
  return {
    mrr: live.reduce((sum, g) => sum + monthlyValue(g), 0),
    active: live.length,
    trial: gyms.filter((g) => g.status === "trial").length,
    suspended: gyms.filter((g) => g.status === "suspended").length,
    dueSoon: gyms.filter((g) => (g.status === "active" || g.status === "trial") && daysUntil(g.renewalDate) >= 0 && daysUntil(g.renewalDate) <= 7),
    overdue: gyms.filter((g) => g.status === "active" && daysUntil(g.renewalDate) < 0),
  };
}

// Live view of every cluster; a cluster that does not answer gets its error instead.
export async function liveClusters(clusters: { id: string; appUrl: string; apiKeyEncrypted: string }[]) {
  const results = await Promise.allSettled(clusters.map(async (c) => ({ status: await clusterStatus(c), gyms: await clusterGyms(c) })));
  const out = new Map<string, { status?: ClusterStatus; gyms?: RemoteGym[]; error?: string }>();
  results.forEach((r, i) => out.set(clusters[i].id, r.status === "fulfilled" ? r.value : { error: r.reason instanceof Error ? r.reason.message : "Unreachable" }));
  return out;
}
