/** Photo upload — the max-rage lifeline. Offline-tolerant like everything
 * else: server unreachable -> local fallback decision (reduced tier), the
 * moment is never blocked on the network. */
import { getIdentity } from "./account";
import type { PhotoDecision } from "./gen/contracts";

export async function uploadPetPhoto(
  file: File, liveCapture: boolean, sessionId?: string,
): Promise<PhotoDecision> {
  const id = getIdentity();
  const offline: PhotoDecision = {
    photo_id: "00000000-0000-0000-0000-000000000000",
    bonus_tier: "reduced", is_animal: true, classifier_label: "offline",
    rage_floor: 55, energy_granted: false, reject_quip_key: null,
  };
  if (!id) return offline;
  try {
    const form = new FormData();
    form.append("file", file);
    form.append("live_capture", String(liveCapture));
    if (sessionId) form.append("session_id", sessionId);
    const res = await fetch("/api/v1/photos", {
      method: "POST",
      headers: { authorization: `Bearer ${id.access_token}` },
      body: form,
    });
    if (!res.ok) return offline;
    return (await res.json()) as PhotoDecision;
  } catch {
    return offline;
  }
}
