// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Fonctions de texte partagées entre le générateur du catalogue (Node) et la page d'administration (navigateur). */

/** Transforme un nom (accents, espaces, majuscules) en identifiant stable pour une URL. */
export function slugifier(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '-')
    .replace(/^-+|-+$/g, '');
}

/** Normalise un hashtag : sans « # », en minuscules, espaces remplacés par des tirets. */
export function normaliserHashtag(hashtag: string): string {
  return hashtag.trim().replace(/^#+/, '').toLowerCase().replace(/\s+/g, '-');
}

/** Titre lisible déduit d'un nom de fichier sans extension. */
export function titreDepuisNomFichier(nomSansExtension: string): string {
  return nomSansExtension.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Normalise une date issue des tags ID3 (« 2024 », « 2024-05-03T… ») en date ISO partielle. */
export function normaliserDate(brut: string | number | undefined): string | undefined {
  if (brut === undefined) return undefined;
  const correspondance = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?/.exec(String(brut).trim());
  if (correspondance === null) return undefined;
  const [, annee, mois, jour] = correspondance;
  if (annee === undefined) return undefined;
  if (mois === undefined) return annee;
  return jour === undefined ? `${annee}-${mois}` : `${annee}-${mois}-${jour}`;
}
