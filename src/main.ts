import confetti from 'canvas-confetti';
import './style.css';
import { maybeShowUpdate, setBusyCheck } from './pwa';
import { blip, boom, doom, DOOM_HIT_MS, isMuted, setMuted, tick, unlockAudio } from './sound';
import { AMOUNTS, DRINKS, loadSettings, rollServing, saveSettings } from './settings';

const stage = document.getElementById('stage')!;
const hud = document.getElementById('hud')!;
const flash = document.getElementById('flash')!;
const muteBtn = document.getElementById('mute') as HTMLButtonElement;

const COLORS = ['#ffb703', '#3ad1ff', '#7cff6b', '#b14aed', '#ff7ae0', '#ff8a3d', '#4dffd2', '#fff35c', '#8f9bff', '#ff5ea8'];
const SETTLE_MS = 1500; // fingers must stay put this long before the countdown
const COUNT_FROM = 3; // fixed countdown (seconds)

type Special = 'everyone' | 'choose' | 'two';
// Special results are rare (~10% of rounds in total) and never happen twice in a row.
const SPECIALS: { kind: Special; chance: number }[] = [
  { kind: 'everyone', chance: 0.04 },
  { kind: 'choose', chance: 0.03 },
  { kind: 'two', chance: 0.03 },
];

interface Finger {
  x: number;
  y: number;
  el: HTMLDivElement;
  color: string;
  mouse: boolean;
  lifted: boolean;
}

type State = 'idle' | 'waiting' | 'counting' | 'result';

const fingers = new Map<string, Finger>();
let state: State = 'idle';
let settleTimer: number | undefined;
let countTimer: number | undefined;
let resetTimer: number | undefined;
let colorIdx = 0;
let mouseId = 0;
let lastWasSpecial = false;
const settings = loadSettings();

// --- Helpers ---------------------------------------------------------------

function setHud(html: string): void { hud.innerHTML = html; }

function showIdle(): void {
  setHud(
    '<div class="title logo">Viimeinen Rokkari pystyssä</div>' +
    '<div class="hint strong">Kuka juo?</div>' +
    '<div class="hint">Laittakaa sormet ruudulle!</div>',
  );
  document.body.classList.remove('playing');
  maybeShowUpdate();
}

function vibrate(p: number | number[]): void {
  try { navigator.vibrate?.(p); } catch { /* not supported */ }
}

function flashScreen(): void {
  flash.classList.remove('on');
  void flash.offsetWidth; // restart animation
  flash.classList.add('on');
}

function clearTimers(): void {
  clearTimeout(settleTimer);
  clearInterval(countTimer);
  settleTimer = countTimer = undefined;
  document.body.classList.remove('counting');
}

const pointerKey = (e: PointerEvent): string => 'p' + e.pointerId;

// --- Fingers ---------------------------------------------------------------

function addFinger(id: string, x: number, y: number, mouse: boolean): void {
  const el = document.createElement('div');
  el.className = 'finger';
  const color = COLORS[colorIdx++ % COLORS.length];
  el.style.setProperty('--c', color);
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  stage.appendChild(el);
  fingers.set(id, { x, y, el, color, mouse, lifted: false });
  document.body.classList.add('playing');
  vibrate(15);
  blip(fingers.size);
}

function removeFinger(id: string): void {
  fingers.get(id)?.el.remove();
  fingers.delete(id);
}

// --- Game flow -------------------------------------------------------------

/** Called whenever the set of fingers changes (outside the result state). */
function fingersChanged(): void {
  clearTimers();
  const n = fingers.size;
  if (n === 0) { state = 'idle'; showIdle(); return; }
  state = 'waiting';
  if (n === 1) {
    setHud('<div class="hint">Lisää sormia…<br>(vähintään 2)</div>');
    return;
  }
  setHud(`<div class="hint">${n} sormea. Pysykää paikoillanne…</div>`);
  settleTimer = window.setTimeout(startCountdown, SETTLE_MS);
}

function startCountdown(): void {
  state = 'counting';
  document.body.classList.add('counting');
  let left = COUNT_FROM;
  const show = () => {
    setHud(`<div class="big">${left}</div>`);
    vibrate(40);
    tick(left);
  };
  show();
  countTimer = window.setInterval(() => {
    left--;
    if (left > 0) show();
    else { clearTimers(); pickResult(); }
  }, 1000);
}

function burstAt(f: Finger, colors: string[], count = 120): void {
  void confetti({
    particleCount: count,
    spread: 360,
    startVelocity: 35,
    ticks: 120,
    origin: { x: f.x / window.innerWidth, y: f.y / window.innerHeight },
    colors,
    disableForReducedMotion: true,
  });
}

function rollSpecial(fingerCount: number): Special | null {
  if (lastWasSpecial) return null;
  let r = Math.random();
  for (const { kind, chance } of SPECIALS) {
    if (r < chance) return kind === 'two' && fingerCount < 3 ? null : kind;
    r -= chance;
  }
  return null;
}

function markWinner(f: Finger, text: string): void {
  f.el.classList.add('winner');
  const label = document.createElement('div');
  label.className = 'label';
  label.textContent = text;
  f.el.appendChild(label);
}

function pickResult(): void {
  state = 'result';
  const list = [...fingers.values()];
  const special = rollSpecial(list.length);
  lastWasSpecial = special !== null;
  flashScreen();
  vibrate([200, 80, 200]);

  const pick = () => list[Math.floor(Math.random() * list.length)];
  const winColors = ['#ff2d4b', '#ffb703', '#ffffff'];

  if (special === 'everyone') {
    const serving = rollServing(settings);
    list.forEach(f => f.el.classList.add('winner'));
    setHud(`<div class="title">KAIKKI JUOVAT!</div><div class="hint strong">${serving.detail}</div>`);
    doom();
    // Confetti lands on the big hit at the end of the build-up.
    window.setTimeout(() => {
      flashScreen();
      vibrate([300, 100, 300]);
      list.forEach(f => burstAt(f, [f.color, '#ffffff'], 60));
      void confetti({ particleCount: 200, spread: 120, origin: { y: 0.9 }, disableForReducedMotion: true });
    }, DOOM_HIT_MS);
  } else if (special === 'two') {
    const first = pick();
    let second = pick();
    while (second === first) second = pick();
    list.forEach(f => { if (f !== first && f !== second) f.el.classList.add('loser'); });
    [first, second].forEach(f => {
      markWinner(f, rollServing(settings).label);
      burstAt(f, winColors, 80);
    });
    setHud('<div class="title">KAKSI JUO!</div>');
    boom();
  } else {
    const w = pick();
    const serving = rollServing(settings);
    list.forEach(f => { if (f !== w) f.el.classList.add('loser'); });
    if (special === 'choose') {
      markWinner(w, 'VALITSE!');
      setHud(`<div class="hint strong">Sinä saat valita kuka juo!<br>${serving.detail}</div>`);
    } else {
      markWinner(w, serving.label);
      setHud(`<div class="hint strong">${serving.detail}</div>`);
    }
    boom();
    burstAt(w, winColors);
  }

  // Mouse-only (desktop testing) has no "lift", so reset automatically.
  if (list.every(f => f.mouse)) scheduleReset(3500);
}

function scheduleReset(ms: number): void {
  clearTimeout(resetTimer);
  resetTimer = window.setTimeout(resetAll, ms);
}

function resetAll(): void {
  clearTimers();
  clearTimeout(resetTimer);
  for (const id of [...fingers.keys()]) removeFinger(id);
  colorIdx = 0;
  state = 'idle';
  showIdle();
}

// --- Input -----------------------------------------------------------------

stage.addEventListener('pointerdown', e => {
  e.preventDefault();
  unlockAudio();
  if (state === 'result') return;
  if (e.pointerType === 'mouse') {
    // Desktop testing: each click adds a persistent fake finger.
    addFinger('m' + mouseId++, e.clientX, e.clientY, true);
  } else {
    addFinger(pointerKey(e), e.clientX, e.clientY, false);
  }
  fingersChanged();
});

stage.addEventListener('pointermove', e => {
  const f = fingers.get(pointerKey(e));
  if (!f || state === 'result') return;
  f.x = e.clientX;
  f.y = e.clientY;
  f.el.style.left = f.x + 'px';
  f.el.style.top = f.y + 'px';
});

function onUp(e: PointerEvent): void {
  const key = pointerKey(e);
  const f = fingers.get(key);
  if (!f) return;
  if (state === 'result') {
    // Keep the circles visible until everyone has lifted.
    f.lifted = true;
    if ([...fingers.values()].every(x => x.lifted || x.mouse)) scheduleReset(1200);
    return;
  }
  removeFinger(key);
  fingersChanged();
}
stage.addEventListener('pointerup', onUp);
stage.addEventListener('pointercancel', onUp);

muteBtn.addEventListener('click', () => {
  setMuted(!isMuted());
  muteBtn.textContent = isMuted() ? '🔇' : '🔊';
});

// Escape clears fake mouse fingers on desktop.
window.addEventListener('keydown', e => { if (e.key === 'Escape') resetAll(); });

// Block long-press menus and gesture zoom.
window.addEventListener('contextmenu', e => e.preventDefault());
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('touchmove', e => e.preventDefault(), { passive: false });

// --- Settings sheet --------------------------------------------------------

const sheet = document.getElementById('sheet')!;
const drinkChips = document.getElementById('drinkChips')!;
const amountChips = document.getElementById('amountChips')!;

function chip(text: string, on: boolean, onClick: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'chip' + (on ? ' on' : '');
  b.textContent = text;
  b.addEventListener('click', onClick);
  return b;
}

function renderSettings(): void {
  drinkChips.replaceChildren(...DRINKS.map(d =>
    chip(`${d.emoji} ${d.name}`, settings.drinks.includes(d.id), () => {
      const has = settings.drinks.includes(d.id);
      // Always keep at least one drink selected.
      if (has && settings.drinks.length === 1) return;
      settings.drinks = has ? settings.drinks.filter(x => x !== d.id) : [...settings.drinks, d.id];
      saveSettings(settings);
      renderSettings();
    })));
  amountChips.replaceChildren(...AMOUNTS.map(a =>
    chip(a === 0 ? 'Arvo 1–5' : `${a} hörppy${a === 1 ? '' : 'ä'}`, settings.amount === a, () => {
      settings.amount = a;
      saveSettings(settings);
      renderSettings();
    })));
}

document.getElementById('version')!.textContent = __APP_VERSION__;

document.getElementById('settings')!.addEventListener('click', () => {
  renderSettings();
  sheet.hidden = false;
});
document.getElementById('closeSheet')!.addEventListener('click', () => { sheet.hidden = true; });
sheet.addEventListener('click', e => { if (e.target === sheet) sheet.hidden = true; });

// Don't pop the update toast while fingers are on the screen.
setBusyCheck(() => state !== 'idle');
showIdle();
