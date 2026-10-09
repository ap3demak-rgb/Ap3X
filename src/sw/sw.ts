// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/// <reference lib="webworker" />

import { PREFIXE_CACHE, cachesASupprimer, choisirStrategie } from './strategies';

/** Valeurs injectées au build par `scripts/generer-service-worker.ts`. */
declare const __VERSION__: string;
declare const __BASE__: string;
declare const __PRECHARGEMENT__: readonly string[];

const sw = self as unknown as ServiceWorkerGlobalScope;
const CACHE = `${PREFIXE_CACHE}${__VERSION__}`;
/**
 * Les ressources de l'application ne varient pas selon l'en-tête de la requête. Sans `ignoreVary`, un
 * serveur qui répond `Vary: Origin` (comme `vite preview`) empêche un `<script>` ou une feuille de style
 * de retrouver sa réponse en cache, et l'application ne démarre pas hors ligne.
 */
const CORRESPONDANCE = { ignoreVary: true } as const;

async function precharger(): Promise<void> {
  const cache = await caches.open(CACHE);
  // `reload` évite de précharger une version périmée conservée par le cache HTTP du navigateur.
  await cache.addAll(__PRECHARGEMENT__.map((chemin) => new Request(chemin, { cache: 'reload' })));
}

async function nettoyer(): Promise<void> {
  const noms = await caches.keys();
  await Promise.all(cachesASupprimer(noms, CACHE).map((nom) => caches.delete(nom)));
}

/** Navigation : le réseau d'abord ; hors ligne (ou en erreur), la coquille de l'application. */
async function navigation(requete: Request): Promise<Response> {
  try {
    return await fetch(requete);
  } catch {
    const coquille = await caches.match(`${__BASE__}index.html`, CORRESPONDANCE);
    if (coquille !== undefined) return coquille;
    return Response.error();
  }
}

/** Réponse du cache tout de suite, mise à jour en arrière-plan ; réseau seul s'il n'y a rien en cache. */
async function revalidation(evenement: FetchEvent): Promise<Response> {
  const cache = await caches.open(CACHE);
  const connue = await cache.match(evenement.request, CORRESPONDANCE);
  const miseAJour = fetch(evenement.request).then(async (reponse) => {
    if (reponse.ok) await cache.put(evenement.request, reponse.clone());
    return reponse;
  });
  if (connue !== undefined) {
    evenement.waitUntil(miseAJour.catch(() => undefined));
    return connue;
  }
  return miseAJour;
}

/** Cache d'abord, dans tous les caches de l'application (le précédent sert aux pages restées ouvertes). */
async function cacheDAbord(requete: Request): Promise<Response> {
  const connue = await caches.match(requete, CORRESPONDANCE);
  if (connue !== undefined) return connue;
  const reponse = await fetch(requete);
  if (reponse.ok) await (await caches.open(CACHE)).put(requete, reponse.clone());
  return reponse;
}

sw.addEventListener('install', (evenement) => {
  evenement.waitUntil(precharger().then(() => sw.skipWaiting()));
});

sw.addEventListener('activate', (evenement) => {
  evenement.waitUntil(nettoyer().then(() => sw.clients.claim()));
});

sw.addEventListener('fetch', (evenement) => {
  const { request } = evenement;
  const strategie = choisirStrategie(
    {
      url: request.url,
      methode: request.method,
      mode: request.mode,
      plage: request.headers.has('range'),
    },
    __BASE__,
    sw.location.origin,
  );
  if (strategie === 'navigation') evenement.respondWith(navigation(request));
  else if (strategie === 'revalidation') evenement.respondWith(revalidation(evenement));
  else if (strategie === 'cache-d-abord') evenement.respondWith(cacheDAbord(request));
});
