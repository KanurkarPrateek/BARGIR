// The gym's name, brand colour and logo address for the app's pages, read
// without loading the logo itself (it is served by src/app/api/gym-logo).
import base from "@/lib/prisma";

export interface GymBrand {
  name: string;
  brandColor: string | null;
  // Changes whenever the gym is saved, so browsers fetch a new logo then.
  logoUrl: string | null;
}

export async function gymBrand(gymId: string): Promise<GymBrand | null> {
  const rows = await base.$queryRaw<{ name: string; brandColor: string | null; updatedAt: Date; hasLogo: boolean }[]>`
    SELECT name, "brandColor", "updatedAt", (coalesce(logo, '') <> '') AS "hasLogo" FROM "Gym" WHERE id = ${gymId}`;
  const gym = rows[0];
  if (!gym) return null;
  return {
    name: gym.name,
    brandColor: gym.brandColor,
    logoUrl: gym.hasLogo ? `/api/gym-logo?v=${new Date(gym.updatedAt).getTime()}` : null,
  };
}
