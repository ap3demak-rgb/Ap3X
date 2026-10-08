// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export type Route = 'accueil' | 'licences';

const ROUTES: Record<string, Route> = {
  '': 'accueil',
  '/': 'accueil',
  '/licences': 'licences',
};

/** Route courante déduite du hash (`#/licences`) ; toute route inconnue renvoie à l'accueil. */
export function routeCourante(): Route {
  const chemin = window.location.hash.replace(/^#/, '');
  return ROUTES[chemin] ?? 'accueil';
}

export function ecouterRoute(rappel: () => void): void {
  window.addEventListener('hashchange', rappel);
}
