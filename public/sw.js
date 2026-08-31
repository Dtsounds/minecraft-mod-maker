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

/**
 * Pull the app shell into the cache during install.
 *
 * Without this the first offline load fails, and it fails in a way that looks
 * like the whole feature is broken: a service worker only sees requests made
 * *after* it takes control, and the page that registered it has already
 * finished loading by then. So nothing is cached until a second visit, and a
 * kid who installs the app and immediately goes offline gets an error page.
 *
 * The asset filenames are content-hashed and therefore unknown until build
 * time. Rather than couple this file to the build, it reads index.html and
 * follows what the page actually references — scripts, styles, icons, the
 * manifest — and then follows url() out of the stylesheets, which is where the
 * font lives. Self-healing: new build, new hashes, same code.
 *
 * Every URL is resolved against the registration scope, so this works
 * unchanged whether the app is served from a domain root or from a subpath
 * like username.github.io/<repo>/ — which is what GitHub Pages does.
 */
async function precacheAppShell() {
  const cache = await caches.open(CACHE);
  const shell = new URL('./', self.registration.scope).toString();

  const page = await fetch(shell, { cache: 'reload' });
  if (!page.ok) return;
  await cache.put(shell, page.clone());

  const html = await page.text();
  const urls = new Set();
  const sameOrigin = (href, base) => {
    try {
      const url = new URL(href, base);
      return url.origin === self.location.origin ? url.toString() : null;
    } catch {
      return null;
    }
  };

  for (const [, href] of html.matchAll(/(?:src|href)="([^"]+)"/g)) {
    const url = sameOrigin(href, shell);
    if (url) urls.add(url);
  }

  // Stylesheets reference the font, and nothing in the HTML mentions it.
  for (const url of [...urls].filter((u) => u.endsWith('.css'))) {
    try {
      const css = await fetch(url);
      if (!css.ok) continue;
      const text = await css.text();
      for (const [, ref] of text.matchAll(/url\(["']?([^"')]+)["']?\)/g)) {
        const resolved = sameOrigin(ref, url);
        if (resolved) urls.add(resolved);
      }
    } catch {
      /* a stylesheet we cannot read just misses its sub-resources */
    }
  }

  // allSettled: one unreachable asset must not abandon the whole precache.
  await Promise.allSettled([...urls].map((url) => cache.add(url)));
}

self.addEventListener('install', (event) => {
  event.waitUntil(precacheAppShell());
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
