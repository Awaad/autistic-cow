/** Replay capture — the share loop.
 * shape: lives UI-side; the engine only emits `moment` markers on the
 * bus. Record-on-moment: 9s from the marker (a slam's full cinematic +
 * humiliation). Priority: cameld > lure > spree. Degrades to silently absent
 * where MediaRecorder is unsupported — the game never depends on capture. */

const PRIORITY: Record<string, number> = { cameld: 3, lure_executed: 2, destruction_spree: 1 };
const CLIP_MS = 9000;

export interface CapturedClip { blob: Blob; kind: string; ext: string }

export class ReplayCapture {
  private stream: MediaStream | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private mime = "";
  private currentKind: string | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private best: CapturedClip | null = null;

  constructor(canvas: HTMLCanvasElement) {
    try {
      for (const m of ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"]) {
        if (typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(m)) {
          this.mime = m;
          break;
        }
      }
      if (this.mime) this.stream = canvas.captureStream(30);
    } catch {
      this.stream = null;
    }
  }

  onMoment(kind: string): void {
    if (!this.stream || !this.mime) return;
    const p = PRIORITY[kind] ?? 0;
    if (this.currentKind && (PRIORITY[this.currentKind] ?? 0) >= p) return;
    if (this.best && (PRIORITY[this.best.kind] ?? 0) >= p) return;
    this.abortCurrent();
    try {
      this.chunks = [];
      this.currentKind = kind;
      this.recorder = new MediaRecorder(this.stream, { mimeType: this.mime, videoBitsPerSecond: 2_500_000 });
      this.recorder.ondataavailable = (e) => { if (e.data.size > 0) this.chunks.push(e.data); };
      this.recorder.onstop = () => this.finalize();
      this.recorder.start(1000);
      this.timer = setTimeout(() => {
        if (this.recorder && this.recorder.state !== "inactive") this.recorder.stop();
      }, CLIP_MS);
    } catch {
      this.currentKind = null;
    }
  }

  async harvest(): Promise<CapturedClip | null> {
    if (this.recorder && this.recorder.state !== "inactive") {
      const done = new Promise<void>((res) => {
        this.recorder!.onstop = () => { this.finalize(); res(); };
      });
      this.recorder.stop();
      await done;
    }
    return this.best;
  }

  dispose(): void {
    this.abortCurrent();
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.best = null;
  }

  private finalize(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.currentKind && this.chunks.length) {
      this.best = {
        blob: new Blob(this.chunks, { type: this.mime }),
        kind: this.currentKind,
        ext: this.mime.includes("mp4") ? "mp4" : "webm",
      };
    }
    this.currentKind = null;
    this.recorder = null;
    this.chunks = [];
  }

  private abortCurrent(): void {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    if (this.recorder && this.recorder.state !== "inactive") {
      this.recorder.onstop = null;
      try { this.recorder.stop(); } catch { /* already stopped */ }
    }
    this.recorder = null;
    this.chunks = [];
    this.currentKind = null;
  }
}

export async function shareClip(clip: CapturedClip): Promise<"shared" | "downloaded"> {
  const file = new File([clip.blob], `cow-moment-${clip.kind}.${clip.ext}`, { type: clip.blob.type });
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (nav.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return "shared";
    } catch { /* user cancelled */ }
  }
  const url = URL.createObjectURL(clip.blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = file.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
  return "downloaded";
}
