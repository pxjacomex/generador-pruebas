/*
 * Service worker del Generador de pruebas (ámbito: la raíz del sitio).
 * Código propio, sin librerías. Deja la página utilizable sin conexión después
 * de la primera visita:
 *  - Al instalarse guarda los archivos de la app (ASSETS).
 *  - Las peticiones del propio ámbito van primero a la red (así las versiones
 *    nuevas llegan enseguida) y, si no hay conexión, salen de la caché.
 *  - Las fuentes de Google se guardan la primera vez y se sirven desde caché.
 *  - KaTeX y sus fuentes van en vendor/ y se precargan con el resto.
 */
'use strict';

const VERSION = 'v2';  // subir al añadir o quitar archivos de ASSETS (v2: KaTeX)
const CACHE = 'generador-' + VERSION;
const ASSETS = [
  './',
  './index.html',
  './css/generador.css',
  './js/util.js',
  './js/formulas.js',
  './js/almacen.js',
  './js/modelo.js',
  './js/vista.js',
  './js/banco.js',
  './js/armado.js',
  './js/guardadas.js',
  './js/app.js',
  './img/cabecera_v2.png',
  './banco/ejemplos.json',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png',
  // KaTeX (ecuaciones LaTeX), alojado en vendor/ para funcionar sin conexión
  './vendor/katex/katex.min.js',
  './vendor/katex/katex.min.css',
  './vendor/katex/fonts/KaTeX_AMS-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Caligraphic-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Caligraphic-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Fraktur-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Fraktur-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Main-Bold.woff2',
  './vendor/katex/fonts/KaTeX_Main-BoldItalic.woff2',
  './vendor/katex/fonts/KaTeX_Main-Italic.woff2',
  './vendor/katex/fonts/KaTeX_Main-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Math-BoldItalic.woff2',
  './vendor/katex/fonts/KaTeX_Math-Italic.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Bold.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Italic.woff2',
  './vendor/katex/fonts/KaTeX_SansSerif-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Script-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size1-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size2-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size3-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Size4-Regular.woff2',
  './vendor/katex/fonts/KaTeX_Typewriter-Regular.woff2',
];
const FUENTES = ['fonts.googleapis.com', 'fonts.gstatic.com'];
const AMBITO = new URL('./', self.location.href).pathname;

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((a) => new Request(a, { cache: 'no-cache' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k.startsWith('generador-') && k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function claveCache(urlString) {
  const u = new URL(urlString);
  u.search = '';
  u.hash = '';
  return u.href;
}

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  let url;
  try { url = new URL(req.url); } catch (_) { return; }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') return;

  if (FUENTES.includes(url.hostname)) {
    event.respondWith(cachePrimero(req));
    return;
  }
  if (url.origin === self.location.origin && url.pathname.startsWith(AMBITO)) {
    event.respondWith(redPrimero(req));
  }
});

async function cachePrimero(req) {
  const cache = await caches.open(CACHE);
  const guardada = await cache.match(req, { ignoreVary: true });
  if (guardada) return guardada;
  const resp = await fetch(req);
  if (resp.ok || resp.type === 'opaque') cache.put(req, resp.clone()).catch(() => {});
  return resp;
}

async function redPrimero(req) {
  const cache = await caches.open(CACHE);
  const clave = claveCache(req.url);
  try {
    const resp = await fetch(clave, { cache: 'no-cache', credentials: 'same-origin' });
    if (resp.ok && !resp.redirected) await cache.put(clave, resp.clone());
    return resp;
  } catch (_) {
    const guardada = await cache.match(clave, { ignoreVary: true });
    if (guardada) return guardada;
    if (req.mode === 'navigate') {
      const indice = await cache.match(new URL('./index.html', self.location.href).href, { ignoreVary: true });
      if (indice) return indice;
    }
    return new Response('Sin conexión y el recurso no está en caché.', {
      status: 503, statusText: 'Offline', headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }
}
