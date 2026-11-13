// Metal-flavoured synth sound effects with the Web Audio API (no audio files needed).
//
// Signal flow:  clean sounds ---------------------------------------> master -> compressor -> limiter -> speakers
//               distorted sounds -> amp (clipper) -> cabinet filters -> master
// The compressor keeps the loud hits from clipping on phone speakers.

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let amp: WaveShaperNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;

// Root note E3. Phone speakers can't reproduce much below ~150 Hz, so the "heavy" notes
// live here (and the kick has a clicky attack) instead of down at 40-80 Hz.
const ROOT = 164.81;

function distortionCurve(amount: number): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = ((3 + amount) * x * 20 * (Math.PI / 180)) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

/** Must be called from a user gesture (e.g. pointerdown) to unlock audio. */
export function unlockAudio(): void {
  if (!ctx) {
    ctx = new AudioContext();

    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.knee.value = 12;
    comp.ratio.value = 6;
    comp.attack.value = 0.003;
    comp.release.value = 0.15;
    // Brick-wall limiter at the very end so nothing ever clips on a phone speaker.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -4;
    limiter.knee.value = 0;
    limiter.ratio.value = 20;
    limiter.attack.value = 0.001;
    limiter.release.value = 0.1;
    master = ctx.createGain();
    master.gain.value = 0.7;
    // Web Audio compressors add automatic makeup gain, so pin the final ceiling below 0 dBFS.
    const ceiling = ctx.createGain();
    ceiling.gain.value = 0.74;
    master.connect(comp).connect(limiter).connect(ceiling).connect(ctx.destination);

    // Guitar amp: moderate clipping, then a "speaker cabinet" that removes sub-bass mud
    // and the fizzy top end, with a little boost in the mids where phones are loudest.
    amp = ctx.createWaveShaper();
    amp.curve = distortionCurve(20);
    amp.oversample = '4x';
    const lowCut = ctx.createBiquadFilter();
    lowCut.type = 'highpass';
    lowCut.frequency.value = 110;
    const highCut = ctx.createBiquadFilter();
    highCut.type = 'lowpass';
    highCut.frequency.value = 4200;
    const mids = ctx.createBiquadFilter();
    mids.type = 'peaking';
    mids.frequency.value = 1200;
    mids.gain.value = 4;
    const ampOut = ctx.createGain();
    ampOut.gain.value = 0.7;
    amp.connect(lowCut).connect(highCut).connect(mids).connect(ampOut).connect(master);

    // One shared burst of white noise for cymbals and screams
    const len = ctx.sampleRate * 2;
    noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

export function setMuted(m: boolean): void { muted = m; }
export function isMuted(): boolean { return muted; }

// --- Building blocks -----------------------------------------------------------

function tone(
  freq: number, dur: number, type: OscillatorType = 'sine', vol = 0.2,
  slideTo?: number, delay = 0, distorted = false,
): void {
  if (!ctx || !master || !amp || muted) return;
  const t = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  osc.connect(gain).connect(distorted ? amp : master);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

/** Bass drum: a body that still carries on a phone speaker, plus a short beater click. */
function kick(delay = 0, vol = 0.8): void {
  tone(210, 0.12, 'sine', vol, 75, delay);
  tone(2200, 0.02, 'triangle', vol * 0.35, 300, delay);
}

/** Distorted power chord: root + fifth + octave, each slightly detuned for width. */
function powerChord(root: number, dur: number, vol: number, delay = 0): void {
  for (const ratio of [1, 1.5, 2]) tone(root * ratio, dur, 'sawtooth', vol, undefined, delay, true);
  tone(root * 1.007, dur, 'sawtooth', vol, undefined, delay, true); // a little width
}

/** Cymbal-ish crash: high-passed noise that fades out. */
function crash(dur: number, vol: number, delay = 0): void {
  if (!ctx || !master || !noise || muted) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const gain = ctx.createGain();
  src.buffer = noise;
  filter.type = 'highpass';
  filter.frequency.value = 4500;
  gain.gain.setValueAtTime(vol, t);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur);
  src.connect(filter).connect(gain).connect(master);
  src.start(t, Math.random(), dur);
}

/** Rising tone that swells in volume; used for build-ups. */
function swell(from: number, to: number, dur: number, type: OscillatorType, vol: number): void {
  if (!ctx || !master || muted) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(from, t);
  osc.frequency.exponentialRampToValueAtTime(to, t + dur);
  gain.gain.setValueAtTime(0.001, t);
  gain.gain.exponentialRampToValueAtTime(vol, t + dur);
  gain.gain.exponentialRampToValueAtTime(0.001, t + dur + 0.05);
  osc.connect(gain).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.1);
}

/**
 * Death-metal-ish scream: a growling sawtooth that drops in pitch, shaped by two
 * vowel-like filters ("aaah"), plus a layer of noise, all through the amp.
 */
function scream(delay: number, dur = 1.1): void {
  if (!ctx || !amp || !noise || muted) return;
  const t = ctx.currentTime + delay;
  const out = ctx.createGain();
  out.gain.setValueAtTime(0.001, t);
  out.gain.exponentialRampToValueAtTime(0.22, t + 0.06);
  out.gain.exponentialRampToValueAtTime(0.001, t + dur);
  out.connect(amp);

  const osc = ctx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.setValueAtTime(300, t);
  osc.frequency.exponentialRampToValueAtTime(140, t + dur);

  // Fast wobble on the pitch = growl
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 45;
  lfoGain.gain.value = 35;
  lfo.connect(lfoGain).connect(osc.frequency);

  // Two formants, like the mouth shape of an open "aaah"
  for (const [freq, q] of [[750, 5], [1250, 7]] as const) {
    const f = ctx.createBiquadFilter();
    f.type = 'bandpass';
    f.frequency.setValueAtTime(freq, t);
    f.frequency.linearRampToValueAtTime(freq * 0.7, t + dur);
    f.Q.value = q;
    osc.connect(f).connect(out);
  }

  const hiss = ctx.createBufferSource();
  const hissFilter = ctx.createBiquadFilter();
  const hissGain = ctx.createGain();
  hiss.buffer = noise;
  hissFilter.type = 'bandpass';
  hissFilter.frequency.value = 2200;
  hissGain.gain.value = 0.18;
  hiss.connect(hissFilter).connect(hissGain).connect(out);

  osc.start(t); lfo.start(t); hiss.start(t, Math.random(), dur);
  osc.stop(t + dur + 0.05); lfo.stop(t + dur + 0.05);
}

// --- The sounds the game uses ---------------------------------------------------

/** Muted guitar chug when a finger lands; goes up a whole tone per finger. */
export function blip(n: number): void {
  tone(ROOT * 2 ** ((n - 1) / 6), 0.12, 'sawtooth', 1, undefined, 0, true);
}

/** Double-kick roll for the countdown: 2 hits, then 4, then a machine-gun 8. */
export function tick(left: number): void {
  const hits = left >= 3 ? 2 : left === 2 ? 4 : 8;
  const gap = left >= 3 ? 0.14 : left === 2 ? 0.09 : 0.055;
  for (let i = 0; i < hits; i++) kick(i * gap);
}

/** The normal result: kick + crash + a big power chord. */
export function boom(): void {
  kick(0);
  crash(0.9, 0.1);
  powerChord(ROOT, 1.0, 0.1);
}

/** Elimination mode: a heavy chug that gets higher as fewer fingers remain. */
export function elim(remaining: number): void {
  const root = ROOT * 2 ** ((8 - Math.min(remaining, 8)) / 6);
  kick(0);
  powerChord(root, 0.22, 0.14);
}

/** The countdown fake-out: a sad downward dive. */
export function fakeout(): void {
  tone(600, 0.6, 'sawtooth', 0.6, 80, 0, true);
  crash(0.35, 0.08);
}

/** When the big hit lands in doom(), in ms after it starts. */
export const DOOM_HIT_MS = 1700;

/**
 * "Everybody drinks" (~3 s): an accelerating blast-beat under a rising sweep, then a
 * crushing chord, crash and a scream at DOOM_HIT_MS.
 */
export function doom(): void {
  const hit = DOOM_HIT_MS / 1000;
  swell(220, 1100, hit, 'sawtooth', 0.04);
  let t = 0;
  let gap = 0.22;
  while (t < hit - 0.05) {
    kick(t);
    t += gap;
    gap = Math.max(0.05, gap * 0.93);
  }
  kick(hit, 0.9);
  kick(hit + 0.1, 0.9);
  powerChord(ROOT / 2, 1.8, 0.1, hit);
  powerChord(ROOT, 1.5, 0.09, hit);
  crash(1.6, 0.14, hit);
  scream(hit);
}
