/** Engine entry. Stage 1 fills this with the real loop; the contract with
 * the React shell (boot(canvas) -> dispose) is final now. */
import { bus } from "./bus";

export function bootGame(canvas: HTMLCanvasElement): () => void {
  const ctx = canvas.getContext("2d")!; 
  let raf = 0;
  let rage = 0;
  let last = performance.now();

  const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
  };
  resize();
  window.addEventListener("resize", resize);
    
    

  const frame = (now: number) => {
    const dt = (now - last) / 1000;
    last = now;
    rage = Math.min(100, rage + dt * 2); // faster climb so it's watchable

    ctx.fillStyle = "#1a1a2e";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    // the heartbeat: a rage bar, serene-green to berserk-red
    const w = (canvas.width - 80) * (rage / 100);
    ctx.fillStyle = `hsl(${120 - rage * 1.2}, 80%, 50%)`;
    ctx.fillRect(40, canvas.height - 60, w, 24);
    ctx.fillStyle = "#fff";
    ctx.font = "16px monospace";
    ctx.fillText(`RAGE ${Math.round(rage)} — ${bandOf(rage)}`, 40, canvas.height - 72);

    bus.emit({ type: "rageChanged", value: rage, band: bandOf(rage) });
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  return () => {
    cancelAnimationFrame(raf);
    window.removeEventListener("resize", resize);
  };
}

function bandOf(r: number): "serene" | "irritated" | "furious" | "berserk" {
  if (r <= 19) return "serene";
  if (r <= 49) return "irritated";
  if (r <= 79) return "furious";
  return "berserk";
}
