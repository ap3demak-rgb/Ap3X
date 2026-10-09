// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export type Route =
  | { nom: 'accueil' }
  | { nom: 'licences' }
  | { nom: 'albums' }
  | { nom: 'categories' }
  | { nom: 'playlists' }
  | { nom: 'album'; id: string }
  | { nom: 'piste'; id: string }
  | { nom: 'categorie'; id: string }
  | { nom: 'tag'; id: string }
  | { nom: 'artiste'; id: string }
  | { nom: 'playlist'; id: string }
  | { nom: 'recherche'; id: string };

/** Pages à un identifiant : `#/<nom>/<id>`. */
const ROUTES_AVEC_ID = [
  'album',
  'piste',
  'categorie',
  'tag',
  'artiste',
  'playlist',
  'recherche',
] as const;
const ROUTES_SIMPLES = ['licences', 'albums', 'categories', 'playlists'] as const;

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

const lien = (nom: string) => (id: string) => `#/${nom}/${encodeURIComponent(id)}`;

export const lienAlbum = lien('album');
export const lienPiste = lien('piste');
export const lienCategorie = lien('categorie');
export const lienTag = lien('tag');
export const lienArtiste = lien('artiste');
export const lienPlaylist = lien('playlist');
export const lienRecherche = lien('recherche');

export function ecouterRoute(rappel: () => void): void {
  window.addEventListener('hashchange', rappel);
}
