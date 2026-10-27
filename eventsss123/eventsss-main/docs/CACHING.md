# ESS browser caching and offline policy

This policy applies to the browser PWA only. Capacitor/native builds do not register the browser service worker; Capgo remains responsible for native web-layer updates.

- **Precache:** the generated app shell and build assets listed by Workbox's `self.__WB_MANIFEST` injection.
- **Static media:** same-origin scripts, styles, fonts and images use cache-first at runtime where not already precached.
- **Read-only application data:** eligible `GET /api/v1/` event, listing, guest, task, budget, questionnaire and message requests use stale-while-revalidate. IndexedDB snapshots provide offline UI data where callers use the offline data layer.
- **Network-only:** authentication, payments, wallet, escrow, checkout, and all non-GET API requests. Money movement is never queued by the browser worker or served from a cache.
- **Mutation replay:** only explicitly safe non-financial application mutations enter the IndexedDB outbox. The outbox uses stable idempotency keys, ordered replay, bounded retries and visible conflict records. Background Sync is an enhancement; online/focus/resume/timer replay remains the fallback.
- **Navigation fallback:** failed navigation falls back to cached `/index.html`, then `/offline.html`.

Never add authentication responses, payment intents, wallet balances, escrow state or checkout responses to a cache-first/stale-while-revalidate rule.
