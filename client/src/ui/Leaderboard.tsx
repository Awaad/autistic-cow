/** 
 * Per-band leaderboards — psychos compete with psychos.
 */
import { useEffect, useState } from "react";
import type { LeaderboardResponse } from "@net/gen/contracts";
import { t } from "../i18n";

const BANDS = ["menace", "enthusiast", "flexible", "hero", "whisperer"] as const;

export function Leaderboard({ initialBand, onClose }: { initialBand?: string; onClose: () => void }) {
  const [band, setBand] = useState<string>(
    BANDS.includes(initialBand as never) ? (initialBand as string) : "flexible",
  );
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    void fetch(`/api/v1/leaderboards/${band}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [band]);

  return (
    <div style={panel}>
      <h2 style={{ marginTop: 0 }}>{t("leaderboard.title")}</h2>
      <div style={{ display: "flex", gap: 6, flexWrap: "wrap", justifyContent: "center" }}>
        {BANDS.map((b) => (
          <button key={b}
            style={{ ...tab, opacity: b === band ? 1 : 0.5 }}
            onClick={() => setBand(b)}>
            {t(`judge.title.${b}`)}
          </button>
        ))}
      </div>
      <div style={list}>
        {loading && <div style={{ opacity: 0.6 }}>…</div>}
        {!loading && (!data || data.entries.length === 0) && (
          <div style={{ opacity: 0.6 }}>{t("leaderboard.empty")}</div>
        )}
        {!loading && data?.entries.map((e, i) => (
          <div key={i} style={row}>
            <span style={{ opacity: 0.6, width: 26 }}>{i + 1}.</span>
            <span style={{ flex: 1 }}>{e.display_name}</span>
            <span style={{ opacity: 0.8 }}>L{e.level}</span>
            <span style={{ width: 90, textAlign: "right" }}>{e.xp} XP</span>
          </div>
        ))}
      </div>
      <button style={tab} onClick={onClose}>{t("settings.close")}</button>
    </div>
  );
}

const panel: React.CSSProperties = { position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center",
  background: "#1a1a2ef2", color: "#fff", fontFamily: "monospace", gap: 14, zIndex: 28 };
const tab: React.CSSProperties = { fontFamily: "monospace", fontSize: 13,
  padding: "5px 12px", cursor: "pointer" };
const list: React.CSSProperties = { width: 360, maxWidth: "88vw", display: "flex",
  flexDirection: "column", gap: 6, fontSize: 14 };
const row: React.CSSProperties = { display: "flex", gap: 8, alignItems: "baseline" };
