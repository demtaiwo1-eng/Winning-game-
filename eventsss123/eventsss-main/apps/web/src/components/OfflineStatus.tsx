import React from 'react';
import { useOnlineStatus } from '../lib/offline/network';
import { pendingMutationCount } from '../lib/offline/outbox';
import { syncOfflineData } from '../lib/offline/sync';

export default function OfflineStatus() {
  const online = useOnlineStatus();
  const [pending, setPending] = React.useState(0);
  const [syncing, setSyncing] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setPending(await pendingMutationCount());
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 3000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const syncNow = async () => {
    setSyncing(true);
    try {
      await syncOfflineData();
      await refresh();
    } finally {
      setSyncing(false);
    }
  };

  if (online && pending === 0) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      style={{
        position: 'fixed',
        left: 12,
        right: 12,
        bottom: 12,
        zIndex: 9999,
        padding: '10px 14px',
        borderRadius: 10,
        background: online ? '#17351f' : '#3a2410',
        color: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        boxShadow: '0 8px 24px rgba(0,0,0,.2)',
      }}
    >
      <span>
        {online
          ? `${pending} change${pending === 1 ? '' : 's'} waiting to sync.`
          : 'You are offline. Changes will be saved and synced when you reconnect.'}
      </span>

      {online && pending > 0 && (
        <button
          type="button"
          onClick={() => void syncNow()}
          disabled={syncing}
          style={{ whiteSpace: 'nowrap' }}
        >
          {syncing ? 'Syncing…' : 'Sync now'}
        </button>
      )}
    </div>
  );
}
