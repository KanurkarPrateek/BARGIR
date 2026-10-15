// The database client every gym-facing action uses. It adds the current gym
// to every query on gym-owned tables, so one gym can never read or change
// another gym's rows, and refuses to run when no gym is known.
import { UserError } from "@/lib/safe-action";
import base from "@/lib/prisma";
import { getSession } from "@/lib/session";
import { AsyncLocalStorage } from "node:async_hooks";

// Tables whose rows belong to exactly one gym. Exercise and FoodItems are a
// shared library; BiometricDevice is looked up by serial before the gym is
// known, so it is filtered by hand where it is listed.
const TENANT_MODELS = new Set([
  "Member",
  "Services",
  "Sales",
  "Payment",
  "Trainer",
  "Attendance",
  "Enquiry",
  "WhatsappWorkflow",
  "WhatsappCampaign",
  "WhatsappMessage",
  "BiometricPunch",
  "BiometricUser",
  "Batch",
  "Staff",
  "StaffAttendance",
  "Expense",
  "BiometricCommand",
]);

const globalForTenant = global as unknown as {
  gymContext?: AsyncLocalStorage<string>;
};
const gymContext = (globalForTenant.gymContext ??= new AsyncLocalStorage<string>());

// For work that has no signed-in user: the scheduler and biometric machines.
export function runAsGym<T>(gymId: string, fn: () => Promise<T>): Promise<T> {
  // Awaited inside the context on purpose: Prisma queries are lazy and only
  // run when awaited, which would otherwise happen after the context ended.
  return gymContext.run(gymId, async () => await fn());
}

export async function currentGymId(): Promise<string | null> {
  return gymContext.getStore() ?? (await getSession())?.gymId ?? null;
}

export async function requireGymId(): Promise<string> {
  const gymId = await currentGymId();
  if (!gymId) throw new UserError("Please sign in");
  return gymId;
}

// Owners (and the platform admin working inside a gym) can do everything;
// front-desk staff logins cannot see money reports or change setup.
export async function requireOwner(): Promise<void> {
  const session = await getSession();
  if (!session?.gymId) throw new UserError("Please sign in");
  if (session.role === "staff") {
    throw new UserError("Only the gym owner can do this");
  }
}

export async function isOwner(): Promise<boolean> {
  const session = await getSession();
  return !!session?.gymId && session.role !== "staff";
}

export async function currentGymName(): Promise<string> {
  const gym = await base.gym.findUnique({
    where: { id: await requireGymId() },
    select: { name: true },
  });
  return gym?.name ?? "our gym";
}

const prisma = base.$extends({
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        if (!TENANT_MODELS.has(model)) return query(args);
        const gym_id = await requireGymId();
        const a = args as any;

        if (operation === "create") {
          a.data = { ...a.data, gym_id };
        } else if (operation === "createMany" || operation === "createManyAndReturn") {
          a.data = [a.data].flat().map((row: any) => ({ ...row, gym_id }));
        } else {
          // Every read, update and delete is narrowed to this gym.
          a.where = { ...a.where, gym_id };
          if (operation === "upsert") a.create = { ...a.create, gym_id };
        }
        return query(a);
      },
    },
  },
});

// Ids arriving from the browser are checked against the current gym before
// being stored as a link, so a row can never point at another gym's trainer.
export async function requireOwnTrainer(trainerId: string | null | undefined): Promise<void> {
  if (!trainerId) return;
  const trainer = await prisma.trainer.findUnique({ where: { id: trainerId }, select: { id: true } });
  if (!trainer) throw new UserError("Trainer not found");
}

export default prisma;
