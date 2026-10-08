// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { TypeAlbum } from '../../src/catalogue/schemas.ts';

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

/** 1 piste = single, 2 à 6 = EP, 7 ou plus = LP. */
export function deduireTypeAlbum(nombrePistes: number): TypeAlbum {
  if (nombrePistes <= 1) return 'single';
  if (nombrePistes <= 6) return 'ep';
  return 'lp';
}

/** Titre lisible déduit d'un nom de fichier sans extension. */
export function titreDepuisNomFichier(nomSansExtension: string): string {
  return nomSansExtension.replace(/[_]+/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Chemin relatif à public/, encodé segment par segment pour être utilisable dans une URL. */
export function urlRelative(...segments: string[]): string {
  return segments.map((segment) => encodeURIComponent(segment)).join('/');
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

export function arrondir(valeur: number, decimales: number): number {
  const facteur = 10 ** decimales;
  return Math.round(valeur * facteur) / facteur;
}
