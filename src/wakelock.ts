// Keeps the phone screen from locking while the app is open (Screen Wake Lock API).
// Not supported everywhere; if it isn't, this quietly does nothing.

let sentinel: WakeLockSentinel | null = null;

async function acquire(): Promise<void> {
  if (sentinel || !('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    // The browser releases the lock when the app is hidden; remember that so we can re-acquire.
    sentinel.addEventListener('release', () => { sentinel = null; });
  } catch {
    /* denied (e.g. low battery mode) - nothing to do */
  }
}

export function keepScreenAwake(): void {
  void acquire();
  // Many browsers only allow the first request after a tap.
  document.addEventListener('pointerdown', () => { void acquire(); }, { passive: true });
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void acquire();
  });
}
