// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export type Route =
  | { nom: 'accueil' }
  | { nom: 'licences' }
  | { nom: 'admin' }
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
const ROUTES_SIMPLES = ['licences', 'admin', 'albums', 'categories', 'playlists'] as const;

/** Sépare le chemin d'un hash de ses paramètres : `#/piste/a?t=90` donne `#/piste/a` et `t=90`. */
function separer(hash: string): { chemin: string; parametres: URLSearchParams } {
  const debut = hash.indexOf('?');
  return {
    chemin: debut < 0 ? hash : hash.slice(0, debut),
    parametres: new URLSearchParams(debut < 0 ? '' : hash.slice(debut + 1)),
  };
}

/** Paramètres d'un hash (`?t=1m30s`). */
export function parametresRoute(hash: string): URLSearchParams {
  return separer(hash).parametres;
}

/** Route déduite d'un hash (`#/album/rock--mon-album`) ; toute route inconnue renvoie à l'accueil. */
export function analyserRoute(hash: string): Route {
  const segments = separer(hash)
    .chemin.replace(/^#\/?/, '')
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

/**
 * Instant d'un lien de partage, en secondes : `90`, `90s`, `1m30s`, `1h2m3s`, `1:30` ou `1:02:03`.
 * Renvoie `undefined` si le texte n'est pas un instant valide.
 */
export function analyserInstant(texte: string | null | undefined): number | undefined {
  if (texte === null || texte === undefined) return undefined;
  const brut = texte.trim().toLowerCase();
  if (brut === '') return undefined;
  const horloge = /^(?:(\d+):)?(\d+):(\d{1,2})$/.exec(brut);
  if (horloge !== null) {
    const [, heures = '0', minutes = '0', secondes = '0'] = horloge;
    return Number(heures) * 3600 + Number(minutes) * 60 + Number(secondes);
  }
  const unites = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+(?:\.\d+)?)s?)?$/.exec(brut);
  if (unites === null || !/[\dhms]/.test(brut)) return undefined;
  const [, heures = '0', minutes = '0', secondes = '0'] = unites;
  // « 1h » ou « 2m » seuls : le dernier groupe, vide, vaut 0.
  const total = Number(heures) * 3600 + Number(minutes) * 60 + Number(secondes);
  return Number.isFinite(total) ? Math.floor(total) : undefined;
}

/** Instant au format court des liens de partage : `45s`, `1m30s`, `1h2m3s`. */
export function formaterInstant(secondes: number): string {
  const total = Math.max(0, Math.floor(secondes));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const reste = total % 60;
  if (heures > 0) return `${heures}h${minutes}m${reste}s`;
  if (minutes > 0) return `${minutes}m${reste}s`;
  return `${reste}s`;
}

/** Instant demandé par un hash (`#/piste/a?t=1m30s`), en secondes. */
export function instantDeLHash(hash: string): number | undefined {
  return analyserInstant(parametresRoute(hash).get('t'));
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
