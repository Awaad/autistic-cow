/** The front door. Three states:
 * new visitor -> Play now (anon) | I have an account
 * returning registered -> Welcome back + Continue (their track, level, title)
 * out of energy -> countdown (server said 409) */
import { useEffect, useState } from "react";
import { api } from "@net/api";
import { getIdentity, login } from "@net/account";
import type { ProfileMe } from "@net/gen/contracts";
import { t } from "../i18n";

export function TitleScreen({ onPlay }: { onPlay: () => void }) {
  const [profile, setProfile] = useState<ProfileMe | null>(null);
  const [mode, setMode] = useState<"root" | "login">("root");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const id = getIdentity();

  useEffect(() => {
    if (!id || id.anon) return;
    void api.getConsents; // (typecheck aid for tree-shaken import paths)
    void fetch("/api/v1/me", { headers: { authorization: `Bearer ${id.access_token}` } })
      .then((r) => (r.ok ? r.json() : null))
      .then((p) => setProfile(p))
      .catch(() => undefined);
  }, []);

  const doLogin = async (): Promise<void> => {
    setErr(null);
    try {
      await login(email, password);
      onPlay();
    } catch {
      setErr(t("wall.err_creds"));
    }
  };

  return (
    <div style={screen}>
      <h1 style={{ fontSize: 42, margin: 0, letterSpacing: 2 }}>Eina The Cow</h1>
      <p style={{ opacity: 0.8, marginTop: 0 }}>{t("title.tagline")}</p>

      {mode === "root" && !profile && (
        <>
          <button style={big} onClick={onPlay}>{t("landing.play")}</button>
          <button style={{ ...big, opacity: 0.7, fontSize: 15 }} onClick={() => setMode("login")}>
            {t("title.have_account")}
          </button>
        </>
      )}

      {mode === "root" && profile && (
        <>
          <p>
            {t("title.welcome_back")}, <b>{profile.display_name}</b>
            <br />
            <span style={{ opacity: 0.8 }}>
              {t("end.level")} {profile.level} · {profile.xp} XP · {t(`judge.title.${profile.axis_band}`)}
            </span>
            <br />
            <span style={{ opacity: 0.7, fontSize: 13 }}>
              {t("energy.label")}: {profile.energy.energy}/{profile.energy.energy_max}
            </span>
          </p>
          <button style={big} onClick={onPlay} disabled={profile.energy.energy <= 0}>
            {profile.energy.energy > 0 ? t("title.continue") : t("energy.empty")}
          </button>
        </>
      )}

      {mode === "login" && (
        <>
          <input style={inp} placeholder={t("wall.email")} value={email}
            onChange={(e) => setEmail(e.target.value)} type="email" />
          <input style={inp} placeholder={t("wall.password")} value={password}
            onChange={(e) => setPassword(e.target.value)} type="password" />
          {err && <div style={{ color: "#ff9d9d" }}>{err}</div>}
          <button style={big} onClick={() => void doLogin()}>{t("wall.login")}</button>
          <button style={{ ...big, opacity: 0.6, fontSize: 13 }} onClick={() => setMode("root")}>
            {t("title.back")}
          </button>
        </>
      )}
    </div>
  );
}

const screen: React.CSSProperties = { position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: "#1a1a2e", color: "#fff", fontFamily: "monospace", gap: 12, zIndex: 25,
  textAlign: "center" };
const big: React.CSSProperties = { fontFamily: "monospace", fontSize: 18,
  padding: "10px 32px", cursor: "pointer" };
const inp: React.CSSProperties = { fontFamily: "monospace", fontSize: 15, padding: "8px 12px",
  width: 260, background: "#0d0d18", color: "#fff", border: "1px solid #444", borderRadius: 4 };
