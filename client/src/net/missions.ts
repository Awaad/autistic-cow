/** Missions API — offline-tolerant: no server, no missions, game unaffected. */
import { getIdentity } from "./account";
import type { MissionList, MissionOffer } from "./gen/contracts";

export async function fetchMission(locale: string): Promise<MissionOffer | null> {
  const id = getIdentity();
  if (!id) return null;
  try {
    const res = await fetch(`/api/v1/missions?locale=${locale}`, {
      headers: { authorization: `Bearer ${id.access_token}` },
    });
    if (!res.ok) return null;
    const list = (await res.json()) as MissionList;
    return list.missions[0] ?? null;
  } catch {
    return null;
  }
}

export async function acceptMission(missionId: string): Promise<void> {
  const id = getIdentity();
  if (!id) return;
  try {
    await fetch(`/api/v1/missions/${missionId}/accept`, {
      method: "POST",
      headers: { authorization: `Bearer ${id.access_token}` },
    });
  } catch { /* offline: local mission still plays */ }
}
