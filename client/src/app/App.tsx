import { useEffect, useRef, useState } from "react";
import { bootGame } from "@game/core/boot";
import { bus, commands, type RageBand } from "../game/core/bus";
import { t, setLocale, type Locale  } from "../i18n";
import { startSync } from "@net/sync";
import { bumpSessionsPlayed, getIdentity, sessionsPlayed } from "@net/account";
import { CookieBanner } from "@ui/CookieBanner";
import { Wall } from "@ui/Wall";
import { ConsentSettings } from "@ui/ConsentSettings";

/** React shell. The engine below the canvas is a React-free zone (Repo Law 1). */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rage, setRage] = useState(20);
  const [band, setBand] = useState<RageBand>("irritated");
  const [score, setScore] = useState(0);
  const [grace, setGrace] = useState(0);
  const [judgeLine, setJudgeLine] = useState<string | null>(null);
  const [rescueHint, setRescueHint] = useState<{ state: string; pct: number }>({ state: "none", pct: 0 });
  const [remaining, setRemaining] = useState<number | null>(null);
  const [nerves, setNerves] = useState(3);
  const [camelNear, setCamelNear] = useState(false);
  const [promptTimer, setPromptTimer] = useState<number | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [pettingAvail, setPettingAvail] = useState(false);
  const [verdict, setVerdict] = useState<{ xp: number; level: number; levelUp: boolean; axisBand: string } | null>(null);
  

  useEffect(() => {
    if (!canvasRef.current) return;
    setEndedReason(null);
    setScore(0);
    setGrace(0);
    setVerdict(null);
    setPromptTimer(null);
    setCamelNear(false);
    const canvas = canvasRef.current;

    const locale = navigator.language.startsWith("de") ? "de"
             : navigator.language.startsWith("ru") ? "ru" : "en";

    let disposeGame: (() => void) | null = null;
    let disposeSync: (() => void) | null = null;
    let cancelled = false;
    setLocale(locale);
    void startSync(locale).then((sync) => {
      if (cancelled) { sync.dispose(); return; }
      disposeSync = sync.dispose;
      disposeGame = bootGame(canvas, { seed: sync.seed, locale });
    });
    const unsub = bus.subscribe((e) => {
      if (e.type === "rageChanged") { setRage(e.value); setBand(e.band); }
      if (e.type === "scoreChanged") { setScore(e.destruction); setGrace(e.rescue); }
      if (e.type === "judgeComment") setJudgeLine(e.text);
      if (e.type === "rescueHint") setRescueHint({ state: e.state, pct: e.pct });
      if (e.type === "timerTick") setRemaining(e.remainingS);
      if (e.type === "nervesChanged") setNerves(e.remaining);
      if (e.type === "camelStateChanged") setCamelNear(e.state === "approaching");
      if (e.type === "maxRageResolutionStarted") setPromptTimer(e.timerS);
      if (e.type === "maxRageResolved") setPromptTimer(null);
      if (e.type === "sessionEnded") { setEndedReason(e.reason); setPromptTimer(null); }
      if (e.type === "bootError") setBootError(e.message);
      if (e.type === "serverVerdict") setVerdict({ xp: e.xp, level: e.level, levelUp: e.levelUp, axisBand: e.axisBand });
    });
    return () => { cancelled = true; unsub(); disposeGame?.(); disposeSync?.(); };
  }, [runKey]);

  // countdown display while the prompt is open (engine owns the real timer)
  useEffect(() => {
    if (promptTimer === null) return;
    const id = setInterval(() => setPromptTimer((v) => (v === null ? null : Math.max(0, v - 0.1))), 100);
    return () => clearInterval(id);
  }, [promptTimer !== null]);

  useEffect(() => {
    if (judgeLine === null) return;
    const id = setTimeout(() => setJudgeLine(null), 6000);
    return () => clearTimeout(id);
  }, [judgeLine]);

  const onPhotoPicked = (): void => commands.emit({ type: "photoProvided" });
  const onRefuse = (): void => commands.emit({ type: "refusePhoto" });

  const mm = remaining === null ? "-" : String(Math.floor(remaining / 60));
  const ss = remaining === null ? "--" : String(Math.floor(remaining % 60)).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <canvas key={runKey} ref={canvasRef} style={{ width: "100%", height: "100%" }} />

      <div style={hud}>
        <div>{t("hud.havoc")} {score} · {t("hud.grace")} {grace}</div>
        <div>{t("nerves.label")} {"♥".repeat(Math.max(0, nerves))}{"♡".repeat(Math.max(0, 3 - nerves))}</div>
        <div>{mm}:{ss}</div>
      </div>

      {camelNear && !promptTimer && <div style={camelBanner}>{t("camel.warning")}</div>}

      {judgeLine && <div style={judgeToast}>{judgeLine}</div>}

      {rescueHint.state !== "none" && !promptTimer && !endedReason && (
        <div style={rescueHintBox}>
          {rescueHint.state === "calm_needed" ? t("rescue.too_worked_up") : t("rescue.soothing")}
          {rescueHint.state === "soothing" && (
            <div style={soothTrack}>
              <div style={{ ...soothFill, width: `${Math.round(rescueHint.pct * 100)}%` }} />
            </div>
          )}
        </div>
      )}

      <div style={rageWrap}>
        <div style={{ marginBottom: 4, textTransform: "uppercase" }}>rage {Math.round(rage)} — {band}</div>
        <div style={rageTrack}>
          <div style={{ ...rageFill, width: `${rage}%`, background: `hsl(${120 - rage * 1.2}, 80%, 50%)` }} />
        </div>
      </div>

      {promptTimer !== null && (
        <div style={{ ...overlay, background: "#0d0d18ee" }}>
          <p style={{ maxWidth: 480, textAlign: "center", fontSize: 20 }}>{t("maxrage.prompt")}</p>
          <div style={{ fontSize: 40 }}>{Math.ceil(promptTimer)}</div>
          <label style={btn}>
            {t("maxrage.show_button")}
            <input type="file" accept="image/*" style={{ display: "none" }} onChange={onPhotoPicked} />
          </label>
          {pettingAvail && (
            <button style={btn} onClick={() => commands.emit({ type: "pettingZoo" })}>
              {t("maxrage.petting_button")}
            </button>
          )}
          <button style={{ ...btn, opacity: 0.6 }} onClick={onRefuse}>{t("maxrage.refuse_button")}</button>
        </div>
      )}

      {bootError && (
        <div style={{ ...overlay, background: "#5c1a1acc" }}>
          <h2 style={{ margin: 0 }}>ENGINE FAILED TO BOOT</h2>
          <p style={{ maxWidth: 600, textAlign: "center" }}>{bootError}</p>
        </div>
      )}

       {endedReason && (getIdentity()?.anon ?? false) && sessionsPlayed() >= 1 ? (
        <Wall
          locale={navigator.language.startsWith("de") ? "de" : navigator.language.startsWith("ru") ? "ru" : "en"}
          onDone={() => setRunKey((k) => k + 1)}
        />
      ) : endedReason && (
        <div style={overlay}>
          <h1 style={{ margin: 0 }}>{endedReason === "cameld" ? t("cameld.title") : t("session.over")}</h1>
          <p>{t("hud.havoc")} {score} · {t("hud.grace")} {grace}</p>
          {verdict && (
            <p style={{ opacity: 0.85 }}>
              {t("end.level")} {verdict.level} · {verdict.xp} XP
              {verdict.levelUp ? ` — ${t("end.level_up")}` : ""} · {t(`judge.title.${verdict.axisBand}`)}
            </p>
          )}
          <button style={btn} onClick={() => setRunKey((k) => k + 1)}>{t("session.again")}</button>
        </div>
      )}
      {!getIdentity()?.anon && getIdentity() && !showSettings && (
        <button style={gear} onClick={() => setShowSettings(true)}>⚙</button>
      )}
      {showSettings && <ConsentSettings onClose={() => setShowSettings(false)} />}
      <CookieBanner />
    </div>
  );
}


const mono: React.CSSProperties = { color: "#fff", fontFamily: "monospace" };
const hud: React.CSSProperties = { ...mono, position: "absolute", top: 16, left: 16, right: 16,
  display: "flex", justifyContent: "space-between", fontSize: 18 };
const judgeToast: React.CSSProperties = { color: "#d8d4e8", fontFamily: "monospace",
  position: "absolute", top: 84, left: 0, right: 0, textAlign: "center",
  fontSize: 16, fontStyle: "italic", opacity: 0.95, padding: "0 40px",
  textShadow: "0 1px 6px #000" };
const rescueHintBox: React.CSSProperties = { color: "#fff", fontFamily: "monospace",
  position: "absolute", bottom: 96, left: 0, right: 0, textAlign: "center", fontSize: 15 };
const soothTrack: React.CSSProperties = { height: 6, width: 180, margin: "6px auto 0",
  background: "#00000066", borderRadius: 3, overflow: "hidden" };
const soothFill: React.CSSProperties = { height: "100%", background: "#7ac74f",
  transition: "width 80ms linear" };
const camelBanner: React.CSSProperties = { ...mono, position: "absolute", top: 56, left: 0, right: 0,
  textAlign: "center", fontSize: 16, letterSpacing: 4, opacity: 0.85 };
const rageWrap: React.CSSProperties = { ...mono, position: "absolute", left: 40, right: 40, bottom: 28 };
const rageTrack: React.CSSProperties = { height: 22, background: "#00000066", borderRadius: 4, overflow: "hidden" };
const rageFill: React.CSSProperties = { height: "100%", transition: "width 120ms linear" };
const overlay: React.CSSProperties = { ...mono, position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2ecc", gap: 12 };
const btn: React.CSSProperties = { fontFamily: "monospace", fontSize: 18, padding: "8px 24px", cursor: "pointer" };
const gear: React.CSSProperties = { position: "absolute", top: 12, right: 12, fontSize: 20,
  background: "transparent", color: "#fff", border: "none", cursor: "pointer", zIndex: 20 };
