import { useEffect, useRef, useState } from "react";
import { bootGame } from "@game/core/boot";
import { bus } from "../game/core/bus";

/** React shell. The engine below this line is a React-free zone. */
export function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [band, setBand] = useState("serene");
  useEffect(() => bus.subscribe((e) => {
    if (e.type === "rageChanged") setBand(e.band);
  }), []);


  useEffect(() => {
    if (!canvasRef.current) return;
    const dispose = bootGame(canvasRef.current);
    return dispose;
  }, []);

  return (
    <div style={{ position: "absolute", top: 16, left: 16, color: "#fff",
              fontFamily: "monospace", textTransform: "uppercase" }}>
      <canvas ref={canvasRef} style={{ width: "100%", height: "100%" }} />
      {/* Later: HUD subscribes to game bus via zustand adapter */}
    </div>
  );
}
