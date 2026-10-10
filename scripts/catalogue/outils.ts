// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { normaliserHashtag } from '../../src/catalogue/texte.ts';

export {
  deduireTypeAlbum,
  normaliserDate,
  normaliserHashtag,
  slugifier,
  titreDepuisNomFichier,
} from '../../src/catalogue/texte.ts';

/** Extrait les hashtags (#mot) d'un texte libre. */
export function extraireHashtags(texte: string): string[] {
  return [...texte.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => normaliserHashtag(m[1] ?? ''));
}

/** Fusionne des listes de hashtags normalisés, sans doublon, en conservant l'ordre. */
export function fusionnerHashtags(...listes: string[][]): string[] {
  const vus = new Set<string>();
  for (const liste of listes) {
    for (const hashtag of liste) {
      const normalise = normaliserHashtag(hashtag);
      if (normalise !== '') vus.add(normalise);
    }
  }
  return [...vus];
}

/** Chemin relatif à public/, encodé segment par segment pour être utilisable dans une URL. */
export function urlRelative(...segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
}

export function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}
