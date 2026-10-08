// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { pistesDeAlbum, type Donnees } from './donnees';
import type { Album, Catalogue, Piste } from './schemas';

/** Critères de tri des pistes et des albums. */
export const CLES_TRI = ['recent', 'ancien', 'titre', 'duree', 'artiste'] as const;
export type CleTri = (typeof CLES_TRI)[number];

export function estCleTri(valeur: string): valeur is CleTri {
  return (CLES_TRI as readonly string[]).includes(valeur);
}

interface Triable {
  id: string;
  titre: string;
  artiste: string;
  date?: string | undefined;
  duree: number;
}

/** Compare deux dates ISO partielles ; une date absente est considérée comme la plus ancienne. */
function comparerDates(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

function trier<T extends Triable>(elements: readonly T[], tri: CleTri, langue: string): T[] {
  const collateur = new Intl.Collator(langue, { sensitivity: 'base', numeric: true });
  const comparer = (a: T, b: T): number => {
    switch (tri) {
      case 'recent':
        return comparerDates(b.date, a.date) || collateur.compare(a.titre, b.titre);
      case 'ancien':
        return comparerDates(a.date, b.date) || collateur.compare(a.titre, b.titre);
      case 'titre':
        return collateur.compare(a.titre, b.titre);
      case 'duree':
        return b.duree - a.duree || collateur.compare(a.titre, b.titre);
      case 'artiste':
        return collateur.compare(a.artiste, b.artiste) || collateur.compare(a.titre, b.titre);
    }
  };
  // L'identifiant départage les égalités : l'ordre est stable d'un affichage à l'autre.
  return [...elements].sort((a, b) => comparer(a, b) || a.id.localeCompare(b.id));
}

export function trierPistes(pistes: readonly Piste[], tri: CleTri, langue: string): Piste[] {
  return trier(pistes, tri, langue);
}

export function trierAlbums(albums: readonly Album[], tri: CleTri, langue: string): Album[] {
  return trier(albums, tri, langue);
}

/** Identifiants des pages spéciales : toutes les pistes, et les favoris du visiteur. */
export const CATEGORIE_TOUT = 'tout';
export const CATEGORIE_FAVORIS = 'favoris';

/** Une piste appartient à la catégorie de son dossier et aux catégories supplémentaires de sa fiche. */
export function dansCategorie(piste: Piste, slug: string): boolean {
  return (
    slug === CATEGORIE_TOUT ||
    piste.categorie === slug ||
    (piste.autresCategories ?? []).includes(slug)
  );
}

export function pistesDeCategorie(donnees: Donnees, slug: string): Piste[] {
  return donnees.catalogue.pistes.filter((p) => dansCategorie(p, slug));
}

export function albumsDeCategorie(donnees: Donnees, slug: string): Album[] {
  return donnees.catalogue.albums.filter((a) => slug === CATEGORIE_TOUT || a.categorie === slug);
}

export function pistesHorsAlbum(pistes: readonly Piste[]): Piste[] {
  return pistes.filter((p) => p.album === undefined);
}

/**
 * File de lecture d'une catégorie : les albums (chacun dans l'ordre de ses pistes), puis les pistes
 * hors album, chaque groupe dans l'ordre d'affichage.
 */
export function fileDeLecture(
  donnees: Donnees,
  albums: readonly Album[],
  pistesSeules: readonly Piste[],
): Piste[] {
  return [...albums.flatMap((album) => pistesDeAlbum(donnees, album)), ...pistesSeules];
}

export interface HashtagCompte {
  nom: string;
  nombre: number;
}

/** Hashtags les plus utilisés (par nombre de pistes), puis par ordre alphabétique. */
export function hashtagsPopulaires(catalogue: Catalogue, nombre: number): HashtagCompte[] {
  return catalogue.hashtags
    .map((h) => ({ nom: h.nom, nombre: h.pistes.length }))
    .sort((a, b) => b.nombre - a.nombre || a.nom.localeCompare(b.nom))
    .slice(0, nombre);
}

export function pistesDuHashtag(donnees: Donnees, nom: string): Piste[] {
  return donnees.catalogue.pistes.filter((p) => p.hashtags.includes(nom));
}

export function albumsDuHashtag(donnees: Donnees, nom: string): Album[] {
  return donnees.catalogue.albums.filter((a) => a.hashtags.includes(nom));
}

/**
 * Taille d'affichage (1 à 5) d'un hashtag dans le nuage, selon son nombre de pistes relativement
 * au minimum et au maximum du nuage.
 */
export function niveauNuage(nombre: number, minimum: number, maximum: number): 1 | 2 | 3 | 4 | 5 {
  if (maximum <= minimum) return 3;
  const niveau = 1 + Math.round(((nombre - minimum) / (maximum - minimum)) * 4);
  return Math.min(5, Math.max(1, niveau)) as 1 | 2 | 3 | 4 | 5;
}
