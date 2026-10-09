// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Donnees } from './donnees';
import type { HashtagCompte } from './navigation';
import type { Album, Categorie, Piste } from './schemas';

/**
 * Normalise un texte pour la recherche : sans accents ni majuscules, ponctuation réduite à des
 * espaces. « Été, Ça-va ! » devient « ete ca va ».
 */
export function normaliser(texte: string): string {
  return texte
    .normalize('NFD')
    .replace(/\p{M}+/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

/** Mots de la requête, normalisés ; un « # » initial (recherche d'un hashtag) est ignoré. */
export function motsDeRecherche(requete: string): string[] {
  return normaliser(requete)
    .split(' ')
    .filter((mot) => mot !== '');
}

export interface ArtisteTrouve {
  nom: string;
  /** Nombre de pistes de l'artiste. */
  nombre: number;
}

export interface ResultatsRecherche {
  pistes: Piste[];
  albums: Album[];
  artistes: ArtisteTrouve[];
  hashtags: HashtagCompte[];
  categories: Categorie[];
  total: number;
}

interface Entree<T> {
  element: T;
  /** Texte principal (titre, nom), normalisé : les correspondances y comptent davantage. */
  principal: string;
  /** Tous les champs interrogeables, normalisés. */
  texte: string;
  /** Tri alphabétique à score égal. */
  libelle: string;
}

interface Index {
  pistes: Entree<Piste>[];
  albums: Entree<Album>[];
  artistes: Entree<ArtisteTrouve>[];
  hashtags: Entree<HashtagCompte>[];
  categories: Entree<Categorie>[];
}

const indexes = new WeakMap<Donnees, Index>();

function construireIndex(donnees: Donnees): Index {
  const { catalogue } = donnees;
  const artistes = new Map<string, number>();
  for (const piste of catalogue.pistes) {
    artistes.set(piste.artiste, (artistes.get(piste.artiste) ?? 0) + 1);
  }
  for (const album of catalogue.albums) {
    if (!artistes.has(album.artiste)) artistes.set(album.artiste, 0);
  }
  return {
    pistes: catalogue.pistes.map((piste) => ({
      element: piste,
      principal: normaliser(piste.titre),
      texte: normaliser(
        [
          piste.titre,
          piste.artiste,
          piste.hashtags.join(' '),
          piste.album !== undefined ? (donnees.albums.get(piste.album)?.titre ?? '') : '',
          donnees.categories.get(piste.categorie)?.nom ?? '',
          piste.description,
        ].join(' '),
      ),
      libelle: piste.titre,
    })),
    albums: catalogue.albums.map((album) => ({
      element: album,
      principal: normaliser(album.titre),
      texte: normaliser(
        [
          album.titre,
          album.artiste,
          album.reference ?? '',
          album.hashtags.join(' '),
          donnees.categories.get(album.categorie)?.nom ?? '',
          album.description,
        ].join(' '),
      ),
      libelle: album.titre,
    })),
    artistes: [...artistes].map(([nom, nombre]) => ({
      element: { nom, nombre },
      principal: normaliser(nom),
      texte: normaliser(nom),
      libelle: nom,
    })),
    hashtags: catalogue.hashtags.map((h) => ({
      element: { nom: h.nom, nombre: h.pistes.length },
      principal: normaliser(h.nom),
      texte: normaliser(h.nom),
      libelle: h.nom,
    })),
    categories: catalogue.categories.map((categorie) => ({
      element: categorie,
      principal: normaliser(categorie.nom),
      texte: normaliser(`${categorie.nom} ${categorie.description}`),
      libelle: categorie.nom,
    })),
  };
}

/**
 * Score d'une entrée pour les mots de la requête, ou 0 si un mot est absent (tous les mots doivent
 * correspondre). Un mot qui commence un mot du titre vaut 3, présent dans le titre 2, ailleurs 1.
 */
function score(entree: Entree<unknown>, mots: readonly string[]): number {
  let total = 0;
  for (const mot of mots) {
    if (!entree.texte.includes(mot)) return 0;
    const debutDeMot = entree.principal.startsWith(mot) || entree.principal.includes(` ${mot}`);
    total += debutDeMot ? 3 : entree.principal.includes(mot) ? 2 : 1;
  }
  return total;
}

function filtrer<T>(entrees: readonly Entree<T>[], mots: readonly string[]): T[] {
  return entrees
    .map((entree) => ({ entree, points: score(entree, mots) }))
    .filter(({ points }) => points > 0)
    .sort((a, b) => b.points - a.points || a.entree.libelle.localeCompare(b.entree.libelle))
    .map(({ entree }) => entree.element);
}

/**
 * Recherche dans les pistes, albums, artistes, hashtags et catégories. Insensible à la casse et aux
 * accents ; tous les mots de la requête doivent se retrouver. Résultats triés par pertinence.
 */
export function rechercher(donnees: Donnees, requete: string): ResultatsRecherche {
  const mots = motsDeRecherche(requete);
  if (mots.length === 0) {
    return { pistes: [], albums: [], artistes: [], hashtags: [], categories: [], total: 0 };
  }
  let index = indexes.get(donnees);
  if (index === undefined) {
    index = construireIndex(donnees);
    indexes.set(donnees, index);
  }
  const pistes = filtrer(index.pistes, mots);
  const albums = filtrer(index.albums, mots);
  const artistes = filtrer(index.artistes, mots);
  const hashtags = filtrer(index.hashtags, mots);
  const categories = filtrer(index.categories, mots);
  return {
    pistes,
    albums,
    artistes,
    hashtags,
    categories,
    total: pistes.length + albums.length + artistes.length + hashtags.length + categories.length,
  };
}

/** Pistes et albums d'un artiste (nom exact). */
export function oeuvresDeLArtiste(
  donnees: Donnees,
  nom: string,
): { albums: Album[]; pistes: Piste[] } {
  return {
    albums: donnees.catalogue.albums.filter((a) => a.artiste === nom),
    pistes: donnees.catalogue.pistes.filter((p) => p.artiste === nom),
  };
}
