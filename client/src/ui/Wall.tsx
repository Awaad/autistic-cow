/** The account wall — "She remembers you. Sign up so she doesn't forget."
 * The merge token in the stored identity makes that sentence literal. */
import { useState } from "react";
import { login, signup } from "@net/account";
import { t } from "../i18n";

export function Wall({ locale, onDone }: { locale: string; onDone: () => void }) {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [year, setYear] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (): Promise<void> => {
    setErr(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        await signup({ email, password, birth_year: Number(year), display_name: name, locale });
      } else {
        await login(email, password);
      }
      onDone();
    } catch (e) {
      const status = (e as { status?: number }).status;
      setErr(
        status === 403 ? t("wall.err_age") :
        status === 409 ? t("wall.err_taken") :
        status === 401 ? t("wall.err_creds") : t("wall.err_generic"),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={overlay}>
      <h1 style={{ margin: 0 }}>{t("wall.title")}</h1>
      <p style={{ marginTop: 0 }}>{t("wall.body")}</p>
      <input style={inp} placeholder={t("wall.email")} value={email}
        onChange={(e) => setEmail(e.target.value)} type="email" />
      <input style={inp} placeholder={t("wall.password")} value={password}
        onChange={(e) => setPassword(e.target.value)} type="password" />
      {mode === "signup" && (
        <>
          <input style={inp} placeholder={t("wall.display_name")} value={name}
            onChange={(e) => setName(e.target.value)} />
          <input style={inp} placeholder={t("wall.birth_year")} value={year}
            onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            inputMode="numeric" />
        </>
      )}
      {err && <div style={{ color: "#ff9d9d" }}>{err}</div>}
      <button style={btn} disabled={busy} onClick={() => void submit()}>
        {mode === "signup" ? t("wall.signup") : t("wall.login")}
      </button>
      <button style={{ ...btn, opacity: 0.6, fontSize: 13 }}
        onClick={() => setMode(mode === "signup" ? "login" : "signup")}>
        {mode === "signup" ? t("wall.have_account") : t("wall.no_account")}
      </button>
    </div>
  );
}

const overlay: React.CSSProperties = { position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: "#1a1a2ef2", color: "#fff", fontFamily: "monospace", gap: 10, zIndex: 30 };
const inp: React.CSSProperties = { fontFamily: "monospace", fontSize: 15, padding: "8px 12px",
  width: 260, background: "#0d0d18", color: "#fff", border: "1px solid #444", borderRadius: 4 };
const btn: React.CSSProperties = { fontFamily: "monospace", fontSize: 16, padding: "8px 24px",
  cursor: "pointer", marginTop: 4 };
