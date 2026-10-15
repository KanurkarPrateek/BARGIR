// Adding members to the gym's WhatsApp group. The sender (worker/) adds them
// from the gym's own number, or sends the group's invite link when their
// privacy settings do not allow being added.
import base from "@/lib/prisma";
import { currentGymName, requireGymId } from "@/lib/tenant";
import { enqueue } from "./queue";
import { groupInvite } from "./messages";

export async function queueGroupAdd(
  member: { id: string; name: string; phone: bigint },
  { automatic }: { automatic: boolean }
): Promise<"queued" | "no-group" | "off" | "already"> {
  const gym = await base.gym.findUnique({ where: { id: await requireGymId() } });
  if (!gym?.whatsappGroupId) return "no-group";
  if (automatic && !gym.autoAddToGroup) return "off";
  const added = await enqueue([{
    name: member.name,
    phone: member.phone,
    body: groupInvite(member.name.split(" ")[0], gym.whatsappGroupName ?? "our group", await currentGymName()),
    groupId: gym.whatsappGroupId,
    // The automatic add happens once per member and group; a staff member
    // pressing the button can always try again.
    dedupeKey: automatic ? `group:${gym.whatsappGroupId}:${member.id}` : undefined,
  }]);
  return added ? "queued" : "already";
}
