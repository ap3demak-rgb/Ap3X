// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Album, Catalogue, Categorie, Piste } from './schemas';

/** Catalogue indexé pour les accès par identifiant utilisés par les pages. */
export interface Donnees {
  catalogue: Catalogue;
  pistes: ReadonlyMap<string, Piste>;
  albums: ReadonlyMap<string, Album>;
  categories: ReadonlyMap<string, Categorie>;
}

export function indexer(catalogue: Catalogue): Donnees {
  return {
    catalogue,
    pistes: new Map(catalogue.pistes.map((p) => [p.id, p])),
    albums: new Map(catalogue.albums.map((a) => [a.id, a])),
    categories: new Map(catalogue.categories.map((c) => [c.slug, c])),
  };
}

const memoire = new WeakMap<Catalogue, Donnees>();

/** Données indexées d'un catalogue, calculées une seule fois et partagées par toute l'application. */
export function donneesDe(catalogue: Catalogue): Donnees {
  let donnees = memoire.get(catalogue);
  if (donnees === undefined) {
    donnees = indexer(catalogue);
    memoire.set(catalogue, donnees);
  }
  return donnees;
}

/** Pistes d'un album, dans l'ordre des disques puis des numéros. */
export function pistesDeAlbum(donnees: Donnees, album: Album): Piste[] {
  return album.pistes
    .map((id) => donnees.pistes.get(id))
    .filter((p): p is Piste => p !== undefined);
}

/** Compare deux dates ISO partielles ; une date absente est considérée comme la plus ancienne. */
function comparerDates(a: string | undefined, b: string | undefined): number {
  return (a ?? '').localeCompare(b ?? '');
}

/** Éléments triés du plus récent au plus ancien (à date égale, par identifiant pour rester stable). */
export function plusRecents<T extends { id: string; date?: string | undefined }>(
  elements: readonly T[],
  nombre: number,
): T[] {
  return [...elements]
    .sort((a, b) => comparerDates(b.date, a.date) || a.id.localeCompare(b.id))
    .slice(0, nombre);
}

/**
 * Pistes proches de `piste` : hashtags en commun (2 points chacun) et même catégorie (1 point).
 * Les pistes sans aucun point commun sont exclues.
 */
export function pistesSimilaires(donnees: Donnees, piste: Piste, nombre: number): Piste[] {
  const hashtags = new Set(piste.hashtags);
  return donnees.catalogue.pistes
    .filter((autre) => autre.id !== piste.id)
    .map((autre) => ({
      autre,
      score:
        autre.hashtags.filter((h) => hashtags.has(h)).length * 2 +
        (autre.categorie === piste.categorie ? 1 : 0),
    }))
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score || a.autre.id.localeCompare(b.autre.id))
    .slice(0, nombre)
    .map(({ autre }) => autre);
}

/** Autres albums de la même catégorie ou du même artiste. */
export function albumsLies(donnees: Donnees, album: Album, nombre: number): Album[] {
  return plusRecents(
    donnees.catalogue.albums.filter(
      (autre) =>
        autre.id !== album.id &&
        (autre.categorie === album.categorie || autre.artiste === album.artiste),
    ),
    nombre,
  );
}

export interface FiltresAlbums {
  type: string;
  categorie: string;
  annee: string;
}

/** Année (AAAA) d'une date ISO partielle. */
export function anneeDe(date: string | undefined): string | undefined {
  return date === undefined ? undefined : date.slice(0, 4);
}

/** Albums correspondant aux filtres, dans l'ordre d'origine (le tri est fait par `trierAlbums`). */
export function filtrerAlbums(albums: readonly Album[], filtres: FiltresAlbums): Album[] {
  return albums.filter(
    (a) =>
      (filtres.type === '' || a.type === filtres.type) &&
      (filtres.categorie === '' || a.categorie === filtres.categorie) &&
      (filtres.annee === '' || anneeDe(a.date) === filtres.annee),
  );
}
