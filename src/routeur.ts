// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export type Route =
  | { nom: 'accueil' }
  | { nom: 'licences' }
  | { nom: 'albums' }
  | { nom: 'album'; id: string }
  | { nom: 'piste'; id: string };

/** Route déduite d'un hash (`#/album/rock--mon-album`) ; toute route inconnue renvoie à l'accueil. */
export function analyserRoute(hash: string): Route {
  const segments = hash
    .replace(/^#\/?/, '')
    .split('/')
    .filter((s) => s !== '')
    .map((segment) => {
      try {
        return decodeURIComponent(segment);
      } catch {
        return segment;
      }
    });
  const [premier, identifiant] = segments;
  if (premier === 'licences' && segments.length === 1) return { nom: 'licences' };
  if (premier === 'albums' && segments.length === 1) return { nom: 'albums' };
  if (premier === 'album' && identifiant !== undefined && segments.length === 2) {
    return { nom: 'album', id: identifiant };
  }
  if (premier === 'piste' && identifiant !== undefined && segments.length === 2) {
    return { nom: 'piste', id: identifiant };
  }
  return { nom: 'accueil' };
}

export function routeCourante(): Route {
  return analyserRoute(window.location.hash);
}

export function lienAlbum(id: string): string {
  return `#/album/${encodeURIComponent(id)}`;
}

export function lienPiste(id: string): string {
  return `#/piste/${encodeURIComponent(id)}`;
}

export function ecouterRoute(rappel: () => void): void {
  window.addEventListener('hashchange', rappel);
}
