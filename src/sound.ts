// Tiny synth sound effects with the Web Audio API (no audio files needed).

let ctx: AudioContext | null = null;
let muted = false;

/** Must be called from a user gesture (e.g. pointerdown) to unlock audio. */
export function unlockAudio(): void {
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

function tone(freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2, slideTo?: number, delay = 0): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Short blip when a finger touches down; pitch rises with finger count. */
export function blip(n: number): void {
  tone(300 + n * 70, 0.12, 'triangle', 0.15);
}

/** Countdown tick. */
export function tick(left: number): void {
  tone(left === 1 ? 880 : 660, 0.15, 'square', 0.08);
}

/** Dramatic result sting. */
export function boom(): void {
  tone(160, 0.6, 'sawtooth', 0.18, 50);
  tone(523, 0.25, 'triangle', 0.15, undefined, 0.05);
  tone(659, 0.25, 'triangle', 0.15, undefined, 0.15);
  tone(784, 0.45, 'triangle', 0.15, undefined, 0.25);
}

/** Big fanfare for "everyone drinks". */
export function fanfare(): void {
  [523, 659, 784, 1047, 784, 1047].forEach((f, i) => tone(f, 0.3, 'square', 0.08, undefined, i * 0.11));
}
