import { useEffect, useRef, useState } from "react";
import { bootGame } from "@game/core/boot";
import { bus, commands, type RageBand } from "../game/core/bus";
import { t } from "../i18n";

/** React shell. The engine below the canvas is a React-free zone. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rage, setRage] = useState(20);
  const [band, setBand] = useState<RageBand>("irritated");
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [nerves, setNerves] = useState(3);
  const [camelNear, setCamelNear] = useState(false);
  const [promptTimer, setPromptTimer] = useState<number | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    setEndedReason(null);
    setScore(0);
    setPromptTimer(null);
    setCamelNear(false);
    const dispose = bootGame(canvasRef.current);
    const unsub = bus.subscribe((e) => {
      if (e.type === "rageChanged") { setRage(e.value); setBand(e.band); }
      if (e.type === "scoreChanged") setScore(e.destruction);
      if (e.type === "timerTick") setRemaining(e.remainingS);
      if (e.type === "nervesChanged") setNerves(e.remaining);
      if (e.type === "camelStateChanged") setCamelNear(e.state === "approaching");
      if (e.type === "maxRageResolutionStarted") setPromptTimer(e.timerS);
      if (e.type === "maxRageResolved") setPromptTimer(null);
      if (e.type === "sessionEnded") { setEndedReason(e.reason); setPromptTimer(null); }
      if (e.type === "bootError") setBootError(e.message);
    });
    return () => { unsub(); dispose(); };
  }, [runKey]);

  // countdown display while the prompt is open (engine owns the real timer)
  useEffect(() => {
    if (promptTimer === null) return;
    const id = setInterval(() => setPromptTimer((v) => (v === null ? null : Math.max(0, v - 0.1))), 100);
    return () => clearInterval(id);
  }, [promptTimer !== null]);

  const onPhotoPicked = (): void => commands.emit({ type: "photoProvided" });
  const onRefuse = (): void => commands.emit({ type: "refusePhoto" });

  const mm = remaining === null ? "-" : String(Math.floor(remaining / 60));
  const ss = remaining === null ? "--" : String(Math.floor(remaining % 60)).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <canvas key={runKey} ref={canvasRef} style={{ width: "100%", height: "100%" }} />

      <div style={hud}>
        <div>{t("hud.score")} {score}</div>
        <div>{t("nerves.label")} {"♥".repeat(Math.max(0, nerves))}{"♡".repeat(Math.max(0, 3 - nerves))}</div>
        <div>{mm}:{ss}</div>
      </div>

      {camelNear && !promptTimer && <div style={camelBanner}>{t("camel.warning")}</div>}

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
          <button style={{ ...btn, opacity: 0.6 }} onClick={onRefuse}>{t("maxrage.refuse_button")}</button>
        </div>
      )}

      {bootError && (
        <div style={{ ...overlay, background: "#5c1a1acc" }}>
          <h2 style={{ margin: 0 }}>ENGINE FAILED TO BOOT</h2>
          <p style={{ maxWidth: 600, textAlign: "center" }}>{bootError}</p>
        </div>
      )}

      {endedReason && (
        <div style={overlay}>
          <h1 style={{ margin: 0 }}>{endedReason === "cameld" ? t("cameld.title") : t("session.over")}</h1>
          <p>{t("hud.score").toLowerCase()}: {score}</p>
          <button style={btn} onClick={() => setRunKey((k) => k + 1)}>{t("session.again")}</button>
        </div>
      )}
    </div>
  );
}

const mono: React.CSSProperties = { color: "#fff", fontFamily: "monospace" };
const hud: React.CSSProperties = { ...mono, position: "absolute", top: 16, left: 16, right: 16,
  display: "flex", justifyContent: "space-between", fontSize: 18 };
const camelBanner: React.CSSProperties = { ...mono, position: "absolute", top: 56, left: 0, right: 0,
  textAlign: "center", fontSize: 16, letterSpacing: 4, opacity: 0.85 };
const rageWrap: React.CSSProperties = { ...mono, position: "absolute", left: 40, right: 40, bottom: 28 };
const rageTrack: React.CSSProperties = { height: 22, background: "#00000066", borderRadius: 4, overflow: "hidden" };
const rageFill: React.CSSProperties = { height: "100%", transition: "width 120ms linear" };
const overlay: React.CSSProperties = { ...mono, position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2ecc", gap: 12 };
const btn: React.CSSProperties = { fontFamily: "monospace", fontSize: 18, padding: "8px 24px", cursor: "pointer" };
