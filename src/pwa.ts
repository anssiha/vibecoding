// Service worker registration + "new version available" toast.
import { registerSW } from 'virtual:pwa-register';

const CHECK_EVERY_MS = 60 * 60 * 1000; // look for updates hourly while the app stays open

const toast = document.getElementById('update')!;
const reloadBtn = document.getElementById('updateBtn')!;
const dismissBtn = document.getElementById('updateLater')!;

let updateWaiting = false;
let dismissed = false;
let isBusy: () => boolean = () => false;

const updateSW = registerSW({
  onNeedRefresh() {
    updateWaiting = true;
    dismissed = false;
    maybeShowUpdate();
  },
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    setInterval(() => { void reg.update(); }, CHECK_EVERY_MS);
    // Also check whenever the app comes back to the foreground.
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') void reg.update();
    });
  },
});

/** Show the toast only when nobody is mid-round. Call again when the game goes idle. */
export function maybeShowUpdate(): void {
  toast.hidden = !(updateWaiting && !dismissed && !isBusy());
}

/** Tell the PWA module how to tell if a round is in progress. */
export function setBusyCheck(fn: () => boolean): void {
  isBusy = fn;
}

reloadBtn.addEventListener('click', () => { void updateSW(true); }); // activates the new SW and reloads
dismissBtn.addEventListener('click', () => { dismissed = true; maybeShowUpdate(); });
