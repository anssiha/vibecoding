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

/** When the big hit lands in doom(), in ms after it starts. */
export const DOOM_HIT_MS = 1700;

function swell(from: number, to: number, dur: number, type: OscillatorType, vol: number): void {
  if (!ctx || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + dur);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t);
  osc.stop(t + dur + 0.1);
}

function crash(dur: number, vol: number, delay: number): void {
  if (!ctx || muted) return;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = buf;
  filter.type = 'highpass';
  filter.frequency.value = 1500;
  const t = ctx.currentTime + delay;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t);
}

/**
 * Dramatic "everyone drinks" sound (~3 s): a heartbeat that speeds up under a rising
 * siren-like sweep, then a huge minor-chord hit with a crash at DOOM_HIT_MS.
 */
export function doom(): void {
  const hit = DOOM_HIT_MS / 1000;
  // Heartbeat that accelerates
  [0, 0.45, 0.85, 1.2, 1.5].forEach(t => tone(70, 0.25, 'sine', 0.35, 40, t));
  // Rising tension sweeps
  swell(110, 880, hit, 'sawtooth', 0.07);
  swell(220, 1320, hit, 'square', 0.03);
  // The hit: deep drop + dark minor chord (A minor) + cymbal-ish crash
  tone(110, 1.6, 'sawtooth', 0.22, 35, hit);
  [220, 261.63, 329.63, 440].forEach(f => tone(f, 1.4, 'sawtooth', 0.09, undefined, hit));
  crash(1.4, 0.25, hit);
}
