import { Capacitor } from '@capacitor/core';
import { replayOutbox } from './outbox';

let syncing = false;

export async function syncOfflineData(): Promise<void> {
  if (syncing || !navigator.onLine) {
    return;
  }

  syncing = true;

  try {
    await replayOutbox();
  } finally {
    syncing = false;
  }
}

export function initOfflineSync(onChange?: () => void): () => void {
  const sync = () => {
    void syncOfflineData().finally(() => {
      onChange?.();
    }).catch((error: unknown) => {
      console.error('Unable to sync offline changes.', error);
    });
  };

  window.addEventListener('online', sync);
  window.addEventListener('focus', sync);

  const visibilityHandler = () => {
    if (document.visibilityState === 'visible') {
      sync();
    }
  };

  document.addEventListener('visibilitychange', visibilityHandler);

  const timer = window.setInterval(sync, 60_000);

  let appListener:
    | { remove: () => Promise<void> }
    | undefined;

  if (Capacitor.isNativePlatform()) {
    void import('@capacitor/app').then(({ App }) => {
      void App.addListener('appStateChange', ({ isActive }) => {
        if (isActive) {
          sync();
        }
      }).then((listener) => {
        appListener = listener;
      });
    });
  }

  void sync();

  return () => {
    window.removeEventListener('online', sync);
    window.removeEventListener('focus', sync);
    document.removeEventListener('visibilitychange', visibilityHandler);
    window.clearInterval(timer);
    void appListener?.remove();
  };
}
