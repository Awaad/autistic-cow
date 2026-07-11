import { useState } from "react";
import { t } from "../i18n";

const KEY = "cowgame.cookieack";

export function CookieBanner() {
  const [ack, setAck] = useState(() => localStorage.getItem(KEY) === "1");
  if (ack) return null;
  return (
    <div style={bar}>
      <span>{t("cookies.notice")}</span>
      <button style={btn} onClick={() => { localStorage.setItem(KEY, "1"); setAck(true); }}>
        {t("cookies.ok")}
      </button>
    </div>
  );
}

const bar: React.CSSProperties = { position: "absolute", bottom: 0, left: 0, right: 0,
  background: "#0d0d18f0", color: "#fff", fontFamily: "monospace", fontSize: 13,
  display: "flex", gap: 16, alignItems: "center", justifyContent: "center",
  padding: "10px 16px", zIndex: 40 };
const btn: React.CSSProperties = { fontFamily: "monospace", padding: "4px 16px", cursor: "pointer" };
