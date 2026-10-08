// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export type Route =
  | { nom: 'accueil' }
  | { nom: 'licences' }
  | { nom: 'albums' }
  | { nom: 'categories' }
  | { nom: 'album'; id: string }
  | { nom: 'piste'; id: string }
  | { nom: 'categorie'; id: string }
  | { nom: 'tag'; id: string };

/** Pages à un identifiant : `#/<nom>/<id>`. */
const ROUTES_AVEC_ID = ['album', 'piste', 'categorie', 'tag'] as const;
const ROUTES_SIMPLES = ['licences', 'albums', 'categories'] as const;

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
  for (const nom of ROUTES_SIMPLES) {
    if (premier === nom && segments.length === 1) return { nom };
  }
  for (const nom of ROUTES_AVEC_ID) {
    if (premier === nom && identifiant !== undefined && segments.length === 2) {
      return { nom, id: identifiant };
    }
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

export function lienCategorie(slug: string): string {
  return `#/categorie/${encodeURIComponent(slug)}`;
}

export function lienTag(nom: string): string {
  return `#/tag/${encodeURIComponent(nom)}`;
}

export function ecouterRoute(rappel: () => void): void {
  window.addEventListener('hashchange', rappel);
}
