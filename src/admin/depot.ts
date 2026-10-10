// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { slugifier } from '../catalogue/texte';
import type { EntreeArbre } from './github';

/** Dossier du dépôt qui contient la musique : un sous-dossier par catégorie. */
export const DOSSIER_MUSIQUE = 'public/musique';

const EXTENSIONS_IMAGE = ['.jpg', '.jpeg', '.png', '.webp'];

export interface FichierDepot {
  chemin: string;
  sha: string;
}

/** Piste telle qu'elle existe dans le dépôt (un MP3, sa fiche JSON et son image éventuelles). */
export interface PisteDepot {
  /** Nom du dossier de la catégorie. */
  categorie: string;
  /** Nom du dossier de l'album, si la piste en fait partie. */
  album?: string;
  /** Nom du fichier sans extension. */
  base: string;
  mp3: FichierDepot;
  fiche?: FichierDepot;
  image?: FichierDepot;
}

/** Album tel qu'il existe dans le dépôt : un sous-dossier de catégorie qui contient `album.json`. */
export interface AlbumDepot {
  /** Nom du dossier de la catégorie. */
  categorie: string;
  /** Nom du dossier de l'album. */
  dossier: string;
  fiche: FichierDepot;
  /** Images du dossier (pochette de l'album, pochettes de pistes). */
  images: FichierDepot[];
  /** Tous les fichiers du dossier, `album.json` compris. */
  fichiers: FichierDepot[];
  pistes: PisteDepot[];
}

/** Catégorie telle qu'elle existe dans le dépôt : un dossier de `public/musique/`. */
export interface CategorieDepot {
  dossier: string;
  /** `categorie.json`, s'il existe. */
  fiche?: FichierDepot;
  /** Images posées directement dans le dossier (pochette de la catégorie, ou image d'un titre seul). */
  images: FichierDepot[];
  /** Tous les fichiers du dossier, à tous les niveaux. */
  fichiers: FichierDepot[];
  pistes: PisteDepot[];
  albums: AlbumDepot[];
}

export interface AnalyseDepot {
  /** Dossiers de catégories, dans l'ordre alphabétique. */
  categories: string[];
  pistes: PisteDepot[];
  albums: AlbumDepot[];
  categoriesDepot: CategorieDepot[];
  /** Tous les chemins de fichiers du dépôt (pour détecter les collisions). */
  chemins: ReadonlySet<string>;
  /** Empreinte Git de chaque fichier du dépôt, par chemin. */
  empreintes: ReadonlyMap<string, string>;
}

const extension = (nom: string): string => {
  const point = nom.lastIndexOf('.');
  return point < 0 ? '' : nom.slice(point).toLowerCase();
};
const sansExtension = (nom: string): string => {
  const point = nom.lastIndexOf('.');
  return point < 0 ? nom : nom.slice(0, point);
};

/** Identifiant public d'une piste, calculé comme le fait le générateur du catalogue. */
export function identifiantPisteDepot(
  piste: Pick<PisteDepot, 'categorie' | 'album' | 'base'>,
): string {
  return [
    slugifier(piste.categorie),
    ...(piste.album === undefined ? [] : [slugifier(piste.album)]),
    slugifier(piste.base),
  ]
    .filter((segment) => segment !== '')
    .join('--');
}

/** Identifiant public d'un album, calculé comme le fait le générateur du catalogue. */
export function identifiantAlbumDepot(album: Pick<AlbumDepot, 'categorie' | 'dossier'>): string {
  return [slugifier(album.categorie), slugifier(album.dossier)].filter((s) => s !== '').join('--');
}

/** Extrait de l'arbre du dépôt les catégories et les pistes de `public/musique/`. */
export function analyserArbre(entrees: readonly EntreeArbre[]): AnalyseDepot {
  const prefixe = `${DOSSIER_MUSIQUE}/`;
  const chemins = new Set<string>();
  const empreintes = new Map<string, string>();
  const categories = new Set<string>();
  const fichiers = new Map<string, FichierDepot>();

  for (const entree of entrees) {
    if (entree.type !== 'blob' && entree.type !== 'tree') continue;
    if (entree.type === 'blob') {
      chemins.add(entree.chemin);
      empreintes.set(entree.chemin, entree.sha);
    }
    if (!entree.chemin.startsWith(prefixe)) continue;
    const segments = entree.chemin.slice(prefixe.length).split('/');
    const [categorie] = segments;
    if (categorie === undefined || categorie === '') continue;
    if (entree.type === 'tree') {
      if (segments.length === 1) categories.add(categorie);
      continue;
    }
    // Un fichier posé à la racine de public/musique n'appartient à aucune catégorie.
    if (segments.length >= 2) categories.add(categorie);
    fichiers.set(entree.chemin, { chemin: entree.chemin, sha: entree.sha });
  }

  const pistes: PisteDepot[] = [];
  for (const fichier of fichiers.values()) {
    if (extension(fichier.chemin) !== '.mp3') continue;
    const segments = fichier.chemin.slice(prefixe.length).split('/');
    if (segments.length < 2 || segments.length > 3) continue;
    const nom = segments.at(-1) ?? '';
    const dossier = fichier.chemin.slice(0, fichier.chemin.length - nom.length);
    const base = sansExtension(nom);
    const piste: PisteDepot = {
      categorie: segments[0] ?? '',
      base,
      mp3: fichier,
      ...(segments.length === 3 && { album: segments[1] ?? '' }),
    };
    const fiche = fichiers.get(`${dossier}${base}.json`);
    if (fiche !== undefined) piste.fiche = fiche;
    for (const ext of EXTENSIONS_IMAGE) {
      const image = fichiers.get(`${dossier}${base}${ext}`);
      if (image !== undefined) {
        piste.image = image;
        break;
      }
    }
    pistes.push(piste);
  }
  pistes.sort((a, b) => a.mp3.chemin.localeCompare(b.mp3.chemin));

  const albums: AlbumDepot[] = [];
  for (const fichier of fichiers.values()) {
    const segments = fichier.chemin.slice(prefixe.length).split('/');
    if (segments.length !== 3 || segments[2] !== 'album.json') continue;
    const [categorie = '', dossier = ''] = segments;
    const racineAlbum = `${prefixe}${categorie}/${dossier}/`;
    const contenu = [...fichiers.values()].filter((f) => f.chemin.startsWith(racineAlbum));
    albums.push({
      categorie,
      dossier,
      fiche: fichier,
      images: contenu.filter((f) => EXTENSIONS_IMAGE.includes(extension(f.chemin))),
      fichiers: contenu,
      pistes: pistes.filter((p) => p.categorie === categorie && p.album === dossier),
    });
  }
  albums.sort((a, b) => a.fiche.chemin.localeCompare(b.fiche.chemin));
  const noms = [...categories].sort((a, b) => a.localeCompare(b));
  const categoriesDepot: CategorieDepot[] = noms.map((dossier) => {
    const racine = `${prefixe}${dossier}/`;
    const contenu = [...fichiers.values()].filter((f) => f.chemin.startsWith(racine));
    const fiche = fichiers.get(`${racine}categorie.json`);
    return {
      dossier,
      ...(fiche !== undefined && { fiche }),
      images: contenu.filter(
        (f) =>
          f.chemin.slice(racine.length).indexOf('/') < 0 &&
          EXTENSIONS_IMAGE.includes(extension(f.chemin)),
      ),
      fichiers: contenu,
      pistes: pistes.filter((p) => p.categorie === dossier),
      albums: albums.filter((a) => a.categorie === dossier),
    };
  });
  return { categories: noms, pistes, albums, categoriesDepot, chemins, empreintes };
}
