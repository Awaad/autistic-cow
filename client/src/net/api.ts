/** Thin API client. Offline-tolerant by design: every call can fail and the
 * game keeps playing locally. */
export interface AnonIdentity { player_id: string; access_token: string; merge_token: string }
export interface SessionStart { session_id: string; spawn_seed: number; district_slug: string }
export interface Verdict { xp: number; level: number; level_up: boolean; moral_axis: number; axis_band: string }

const BASE = "/api/v1";

async function post<T>(path: string, body: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`${path} -> ${res.status}`);
  return (await res.json()) as T;
}

export const api = {
  anon: (locale: string) => post<AnonIdentity>("/auth/anon", { locale }),
  startSession: (token: string) => post<SessionStart>("/sessions", {}, token),
  sendEvents: (token: string, sid: string, events: unknown[]) =>
    post<{ accepted: number }>(`/sessions/${sid}/events`, { events }, token),
  endSession: (token: string, sid: string, summary: unknown) =>
    post<Verdict>(`/sessions/${sid}/end`, summary, token),
};
