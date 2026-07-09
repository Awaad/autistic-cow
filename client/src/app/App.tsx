import { useEffect, useRef, useState } from "react";
import { bootGame } from "@game/core/boot";
import { bus, type RageBand } from "../game/core/bus";

/** React shell. The engine below the canvas is a React-free zone. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rage, setRage] = useState(20);
  const [band, setBand] = useState<RageBand>("irritated");
  const [score, setScore] = useState(0);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [endedReason, setEndedReason] = useState<string | null>(null);
  const [runKey, setRunKey] = useState(0);

  useEffect(() => {
    if (!canvasRef.current) return;
    setEndedReason(null);
    setScore(0);
    const dispose = bootGame(canvasRef.current);
    const unsub = bus.subscribe((e) => {
      if (e.type === "rageChanged") { setRage(e.value); setBand(e.band); }
      if (e.type === "scoreChanged") setScore(e.destruction);
      if (e.type === "timerTick") setRemaining(e.remainingS);
      if (e.type === "sessionEnded") setEndedReason(e.reason);
    });
    return () => { unsub(); dispose(); };
  }, [runKey]);

  const mm = remaining === null ? "-" : String(Math.floor(remaining / 60));
  const ss = remaining === null ? "--" : String(Math.floor(remaining % 60)).padStart(2, "0");

  return (
    <div style={{ position: "fixed", inset: 0 }}>
      <canvas key={runKey} ref={canvasRef} style={{ width: "100%", height: "100%" }} />

      <div style={hud}>
        <div>SCORE {score}</div>
        <div>{mm}:{ss}</div>
      </div>

      <div style={{ ...rageWrap }}>
        <div style={{ marginBottom: 4, textTransform: "uppercase" }}>rage {Math.round(rage)} — {band}</div>
        <div style={rageTrack}>
          <div style={{ ...rageFill, width: `${rage}%`, background: `hsl(${120 - rage * 1.2}, 80%, 50%)` }} />
        </div>
      </div>

      {endedReason && (
        <div style={endOverlay}>
          <h1 style={{ margin: 0 }}>SESSION OVER</h1>
          <p>destruction score: {score}</p>
          <button style={btn} onClick={() => setRunKey((k) => k + 1)}>again</button>
        </div>
      )}
    </div>
  );
}

const mono: React.CSSProperties = { color: "#fff", fontFamily: "monospace" };
const hud: React.CSSProperties = { ...mono, position: "absolute", top: 16, left: 16, right: 16,
  display: "flex", justifyContent: "space-between", fontSize: 18 };
const rageWrap: React.CSSProperties = { ...mono, position: "absolute", left: 40, right: 40, bottom: 28 };
const rageTrack: React.CSSProperties = { height: 22, background: "#00000066", borderRadius: 4, overflow: "hidden" };
const rageFill: React.CSSProperties = { height: "100%", transition: "width 120ms linear" };
const endOverlay: React.CSSProperties = { ...mono, position: "absolute", inset: 0, display: "flex",
  flexDirection: "column", alignItems: "center", justifyContent: "center", background: "#1a1a2ecc", gap: 8 };
const btn: React.CSSProperties = { fontFamily: "monospace", fontSize: 18, padding: "8px 24px", cursor: "pointer" };
