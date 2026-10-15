"use server";

// Batches: the workout time slots members come in (View Batch).
import prisma, { requireOwner } from "@/lib/tenant";
import { Failed } from "@/lib/action-result";
import { UserError, safe } from "@/lib/safe-action";

export interface BatchRow {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  members: number;
}

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/;

export async function GetBatches(): Promise<BatchRow[]> {
  const batches = await prisma.batch.findMany({
    orderBy: { startTime: "asc" },
    include: { _count: { select: { members: true } } },
  });
  return batches.map(({ _count, ...b }) => ({
    id: b.id,
    name: b.name,
    startTime: b.startTime,
    endTime: b.endTime,
    members: _count.members,
  }));
}

export async function SaveBatch(data: { id?: string; name: string; startTime: string; endTime: string }): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    if (!data.name.trim()) throw new UserError("Give the batch a name, e.g. Morning");
    if (!TIME.test(data.startTime) || !TIME.test(data.endTime)) throw new UserError("Times must look like 06:00");
    if (data.endTime <= data.startTime) throw new UserError("The batch must end after it starts");
    const values = { name: data.name.trim(), startTime: data.startTime, endTime: data.endTime };
    if (data.id) await prisma.batch.update({ where: { id: data.id }, data: values });
    else await prisma.batch.create({ data: values });
  });
}

// Members in it simply have no batch afterwards.
export async function DeleteBatch(id: string): Promise<void | Failed> {
  return safe(async () => {
    await requireOwner();
    await prisma.batch.delete({ where: { id } });
  });
}

export async function SetMemberBatch(member_id: string, batch_id: string | null): Promise<void | Failed> {
  return safe(async () => {
    if (batch_id && !(await prisma.batch.findUnique({ where: { id: batch_id } }))) {
      throw new UserError("Batch not found");
    }
    await prisma.member.update({ where: { id: member_id }, data: { batch_id } });
  });
}
