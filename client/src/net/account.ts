/** Identity lifecycle. One localStorage record, two states:
 * anon (has merge_token) -> registered (has refresh_token).
 * Signup passes the merge token: the anonymous history BECOMES the account. */
import { api } from "./api";

export interface StoredIdentity {
  player_id: string;
  access_token: string;
  anon: boolean;
  merge_token?: string;
  refresh_token?: string;
  display_name?: string;
}

const LS_KEY = "cowgame.identity";

export function getIdentity(): StoredIdentity | null {
  const raw = localStorage.getItem(LS_KEY);
  return raw ? (JSON.parse(raw) as StoredIdentity) : null;
}

export function storeIdentity(id: StoredIdentity): void {
  localStorage.setItem(LS_KEY, JSON.stringify(id));
}

export async function ensureAnon(locale: string): Promise<StoredIdentity | null> {
  const existing = getIdentity();
  if (existing) return existing;
  try {
    const a = await api.anon(locale);
    const id: StoredIdentity = {
      player_id: a.player_id, access_token: a.access_token,
      merge_token: a.merge_token, anon: true,
    };
    storeIdentity(id);
    return id;
  } catch {
    return null;
  }
}

export async function signup(fields: {
  email: string; password: string; birth_year: number; display_name: string; locale: string;
}): Promise<StoredIdentity> {
  const current = getIdentity();
  const t = await api.signup({ ...fields, locale: fields.locale as never,
    merge_token: current?.anon ? current.merge_token ?? null : null });
  const id: StoredIdentity = {
    player_id: t.player_id, access_token: t.access_token,
    refresh_token: t.refresh_token, display_name: t.display_name, anon: false,
  };
  storeIdentity(id);
  return id;
}

export async function login(email: string, password: string): Promise<StoredIdentity> {
  const t = await api.login({ email: email as never, password });
  const id: StoredIdentity = {
    player_id: t.player_id, access_token: t.access_token,
    refresh_token: t.refresh_token, display_name: t.display_name, anon: false,
  };
  storeIdentity(id);
  return id;
}

export function sessionsPlayed(): number {
  return Number(localStorage.getItem("cowgame.sessions") ?? 0);
}

export function bumpSessionsPlayed(): void {
  localStorage.setItem("cowgame.sessions", String(sessionsPlayed() + 1));
}
