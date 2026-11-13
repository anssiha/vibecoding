// Drink settings, saved on the device in localStorage.

export type DrinkId = 'beer' | 'shot' | 'wine' | 'cider' | 'soft';

export interface Drink {
  id: DrinkId;
  emoji: string;
  name: string;
  /** Shots are a single "shotti"; everything else is counted in sips. */
  counted: boolean;
}

export const DRINKS: Drink[] = [
  { id: 'beer', emoji: '🍺', name: 'Olut', counted: true },
  { id: 'shot', emoji: '🥃', name: 'Shotti', counted: false },
  { id: 'wine', emoji: '🍷', name: 'Viini', counted: true },
  { id: 'cider', emoji: '🍏', name: 'Siideri', counted: true },
  { id: 'soft', emoji: '🧃', name: 'Alkoholiton', counted: true },
];

/** Amount in sips; 0 means a random 1-5 each round. */
export const AMOUNTS = [1, 2, 3, 5, 0];

export interface Settings {
  drinks: DrinkId[];
  amount: number;
}

const KEY = 'sormipeli.settings';
const DEFAULTS: Settings = { drinks: ['shot'], amount: 2 };

export function loadSettings(): Settings {
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) ?? 'null') as Partial<Settings> | null;
    const drinks = (raw?.drinks ?? []).filter(d => DRINKS.some(x => x.id === d));
    const amount = AMOUNTS.includes(raw?.amount ?? -1) ? raw!.amount! : DEFAULTS.amount;
    return { drinks: drinks.length ? drinks : DEFAULTS.drinks, amount };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  try { localStorage.setItem(KEY, JSON.stringify(s)); } catch { /* private mode etc. */ }
}

export interface Serving {
  drink: Drink;
  sips: number;
  /** Short text for above the finger, e.g. "JUO 🍺×3" or "SHOTTI! 🥃". */
  label: string;
  /** Longer line for the HUD, e.g. "Olut · 3 hörppyä". */
  detail: string;
}

/** Roll a random drink + amount from the current settings. */
export function rollServing(s: Settings): Serving {
  const id = s.drinks[Math.floor(Math.random() * s.drinks.length)];
  const drink = DRINKS.find(d => d.id === id)!;
  const sips = s.amount || 1 + Math.floor(Math.random() * 5);
  if (!drink.counted) {
    return { drink, sips: 1, label: `SHOTTI! ${drink.emoji}`, detail: 'Yksi shotti' };
  }
  return {
    drink,
    sips,
    label: `JUO ${drink.emoji}×${sips}`,
    detail: `${drink.name} · ${sips} ${sips === 1 ? 'hörppy' : 'hörppyä'}`,
  };
}
