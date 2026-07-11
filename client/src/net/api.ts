/** Thin API client, typed EXCLUSIVELY by generated contracts.
 * Offline-tolerant: every call can fail and the game keeps playing locally. */
import type {
  AnonResponse, AuthTokens, ConsentState, LoginRequest,
  SessionEndResponse, SessionStartResponse, SignupRequest,
} from "./gen/contracts";

const BASE = "/api/v1";

async function req<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) {
    const detail = await res.json().catch(() => ({}));
    throw Object.assign(new Error(`${path} -> ${res.status}`), { status: res.status, detail });
  }
  return (await res.json()) as T;
}

export const api = {
  anon: (locale: string) => req<AnonResponse>("POST", "/auth/anon", { locale }),
  signup: (body: SignupRequest) => req<AuthTokens>("POST", "/auth/signup", body),
  login: (body: LoginRequest) => req<AuthTokens>("POST", "/auth/login", body),
  startSession: (token: string) => req<SessionStartResponse>("POST", "/sessions", {}, token),
  sendEvents: (token: string, sid: string, events: unknown[]) =>
    req<{ accepted: number }>("POST", `/sessions/${sid}/events`, { events }, token),
  endSession: (token: string, sid: string, summary: unknown) =>
    req<SessionEndResponse>("POST", `/sessions/${sid}/end`, summary, token),
  getConsents: (token: string) => req<ConsentState>("GET", "/consents", undefined, token),
  setConsent: (token: string, key: string, granted: boolean) =>
    req<ConsentState>("POST", "/consents", { consent_key: key, granted, source: "settings" }, token),
};
