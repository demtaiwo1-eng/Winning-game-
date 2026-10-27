import React from 'react';
import { listConflicts, resolveConflict, type ConflictRecord } from '../lib/offline/db';

export default function SyncConflictList() {
  const [conflicts, setConflicts] = React.useState<ConflictRecord[]>([]);
  const [open, setOpen] = React.useState(false);

  const refresh = React.useCallback(async () => {
    setConflicts(await listConflicts(true));
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(), 5000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  if (!conflicts.length) return null;

  return (
    <aside
      role="region"
      aria-label="Offline sync conflicts"
      style={{ position: 'fixed', right: 12, bottom: 74, zIndex: 9998, width: 'min(460px, calc(100vw - 24px))' }}
    >
      <button type="button" onClick={() => setOpen((value) => !value)} style={{ width: '100%', padding: '10px 14px', borderRadius: 10 }}>
        {conflicts.length} sync conflict{conflicts.length === 1 ? '' : 's'} need attention
      </button>
      {open && (
        <div style={{ marginTop: 8, padding: 12, borderRadius: 10, background: '#1b2235', color: '#fff', maxHeight: '50vh', overflow: 'auto' }}>
          {conflicts.map((conflict) => (
            <article key={conflict.id} style={{ padding: '10px 0', borderBottom: '1px solid rgba(255,255,255,.12)' }}>
              <strong>{conflict.reason}</strong>
              <small style={{ display: 'block', opacity: 0.75, marginTop: 4 }}>{conflict.resource}</small>
              <details style={{ marginTop: 6 }}>
                <summary>View local/server values</summary>
                <pre style={{ whiteSpace: 'pre-wrap', fontSize: 11 }}>{JSON.stringify({ local: conflict.localValue, server: conflict.serverValue }, null, 2)}</pre>
              </details>
              <button type="button" onClick={async () => { await resolveConflict(conflict.id); await refresh(); }} style={{ marginTop: 8 }}>
                Mark resolved
              </button>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}
