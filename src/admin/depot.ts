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

export interface AnalyseDepot {
  /** Dossiers de catégories, dans l'ordre alphabétique. */
  categories: string[];
  pistes: PisteDepot[];
  /** Tous les chemins de fichiers du dépôt (pour détecter les collisions). */
  chemins: ReadonlySet<string>;
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

/** Extrait de l'arbre du dépôt les catégories et les pistes de `public/musique/`. */
export function analyserArbre(entrees: readonly EntreeArbre[]): AnalyseDepot {
  const prefixe = `${DOSSIER_MUSIQUE}/`;
  const chemins = new Set<string>();
  const categories = new Set<string>();
  const fichiers = new Map<string, FichierDepot>();

  for (const entree of entrees) {
    if (entree.type !== 'blob' && entree.type !== 'tree') continue;
    if (entree.type === 'blob') chemins.add(entree.chemin);
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
  return {
    categories: [...categories].sort((a, b) => a.localeCompare(b)),
    pistes,
    chemins,
  };
}
