/**
 * Offline support for Bedrock Mod Maker.
 *
 * Hand-written rather than generated. The app is a handful of static files
 * with no API behind it, so a build-time PWA plugin would be a dependency
 * earning about forty lines of work — and this file is easier to reason about
 * than a generated one when something caches wrongly.
 *
 * Strategy, and why:
 *
 *  - Navigations are network-FIRST. Cache-first on the HTML is the classic way
 *    to ship an app that can never update itself: the kid gets last week's
 *    build forever and no amount of reloading fixes it.
 *  - Everything else is cache-first, because Vite fingerprints asset
 *    filenames — a changed file is a different URL, so a cached one is never
 *    stale, and this is what makes the app open instantly offline.
 *
 * A kid's mods are NOT here. They live in IndexedDB and are never touched by
 * this file; clearing the cache costs a download, never a mod.
 */

const CACHE = 'bedrock-mod-maker-v1';

self.addEventListener('install', () => {
  // Take over as soon as possible rather than waiting for every tab to close.
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      for (const key of await caches.keys()) {
        if (key !== CACHE) await caches.delete(key);
      }
      await self.clients.claim();
    })(),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;

  // Never interfere with anything that is not a plain same-origin read.
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      (async () => {
        try {
          const fresh = await fetch(request);
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
          return fresh;
        } catch {
          // Offline: last good copy of this page, or the app shell.
          return (
            (await caches.match(request)) ??
            (await caches.match('./')) ??
            new Response('Offline, and this page has not been opened before.', {
              status: 503,
              headers: { 'Content-Type': 'text/plain' },
            })
          );
        }
      })(),
    );
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(request);
      if (cached) return cached;
      try {
        const fresh = await fetch(request);
        // Opaque and error responses are not worth persisting.
        if (fresh.ok && fresh.type === 'basic') {
          const cache = await caches.open(CACHE);
          cache.put(request, fresh.clone());
        }
        return fresh;
      } catch {
        return new Response('', { status: 504 });
      }
    })(),
  );
});
