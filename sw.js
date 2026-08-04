// Cache-Name bei jeder inhaltlichen Änderung an dieser Datei erhöhen (v1 -> v2 -> v3 ...).
// Das ist wichtig: der Browser erkennt ein Service-Worker-Update NUR, wenn sich der
// Byte-Inhalt von sw.js ändert. Nur den Cache-Namen zu ändern reicht als Trigger.
const CACHE_NAME = 'cube-timer-v2';
const APP_SHELL = [
  './',
  './index.html',
  './app.js',
  './config.js',
  './style.css',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png',
  './apple-touch-icon.png',
  './favicon-32.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))))
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Supabase-Anfragen (Bestenliste) niemals aus dem Cache beantworten, damit die Daten aktuell bleiben.
  if (url.hostname.endsWith('supabase.co')) return;

  // Network-first für die eigenen App-Dateien: neue Deploys wirken sofort, ohne dass
  // man den Cache-Namen manuell erhöhen muss. Nur wenn kein Netz verfügbar ist (offline),
  // wird auf die zuletzt gecachte Version zurückgegriffen.
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
