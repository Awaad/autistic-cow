/** Consent matrix UI — the 8 keys from docs, appended server-side,
 * latest-wins. functional_tos is shown locked (it IS the account). */
import { useEffect, useState } from "react";
import { api } from "@net/api";
import { getIdentity } from "@net/account";
import { t } from "../i18n";

const KEYS = ["herd_album", "product_analytics", "personalized_comments",
  "marketing_profiling", "real_location_ar", "photo_promotional", "paid_processing"] as const;

export function ConsentSettings({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<Record<string, boolean>>({});
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const id = getIdentity();

  useEffect(() => {
    if (!id || id.anon) return;
    void api.getConsents(id.access_token).then((c) => setState(c.consents)).catch(() => undefined);
  }, []);

  const toggle = async (key: string): Promise<void> => {
    if (!id) return;
    setBusyKey(key);
    try {
      const next = await api.setConsent(id.access_token, key, !state[key]);
      setState(next.consents);
    } finally {
      setBusyKey(null);
    }
  };

  return (
    <div style={panel}>
      <h2 style={{ marginTop: 0 }}>{t("settings.title")}</h2>
      <label style={row}>
        <input type="checkbox" checked disabled /> {t("settings.consent.functional_tos")}
      </label>
      {KEYS.map((k) => (
        <label key={k} style={row}>
          <input type="checkbox" checked={!!state[k]} disabled={busyKey === k}
            onChange={() => void toggle(k)} />
          {" "}{t(`settings.consent.${k}`)}
        </label>
      ))}
      <button style={btn} onClick={onClose}>{t("settings.close")}</button>
    </div>
  );
}

const panel: React.CSSProperties = { position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "flex-start", justifyContent: "center",
  background: "#1a1a2ef2", color: "#fff", fontFamily: "monospace",
  padding: "0 15%", gap: 8, zIndex: 30 };
const row: React.CSSProperties = { fontSize: 14, cursor: "pointer" };
const btn: React.CSSProperties = { fontFamily: "monospace", fontSize: 15,
  padding: "6px 20px", cursor: "pointer", marginTop: 12, alignSelf: "center" };
