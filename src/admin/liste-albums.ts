// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { normaliser } from '../catalogue/recherche';
import { deduireTypeAlbum, titreDepuisNomFichier } from '../catalogue/texte';
import type { TypeAlbum } from '../catalogue/schemas';
import { identifiantAlbumDepot, type AlbumDepot } from './depot';
import type { FicheBrute } from './edition';

/** Ce que la liste d'administration affiche d'un album. */
export interface LigneAlbum {
  id: string;
  titre: string;
  artiste: string;
  type: TypeAlbum;
  categorie: string;
  /** Année de sortie, si la fiche porte une date. */
  annee?: string;
  /** Pistes listées dans `album.json`. */
  nombrePistes: number;
  /** Faux pour un brouillon. */
  visible: boolean;
  /** Des pistes listées dans `album.json` n'ont pas (encore) leur fichier MP3 : envoi interrompu ? */
  incomplet: boolean;
  /** `album.json` est illisible. */
  illisible: boolean;
  album: AlbumDepot;
}

const TYPES: readonly string[] = ['single', 'ep', 'lp', 'compilation'];
const nomDe = (chemin: string): string => chemin.slice(chemin.lastIndexOf('/') + 1);

export function ligneAlbum(album: AlbumDepot, fiche: FicheBrute | undefined): LigneAlbum {
  const listees = Array.isArray(fiche?.['pistes'])
    ? (fiche['pistes'] as unknown[]).map((entree) =>
        typeof entree === 'string'
          ? entree
          : typeof (entree as FicheBrute | null)?.['fichier'] === 'string'
            ? ((entree as FicheBrute)['fichier'] as string)
            : '',
      )
    : [];
  const presentes = new Set(album.pistes.map((p) => nomDe(p.mp3.chemin)));
  const type = typeof fiche?.['type'] === 'string' ? fiche['type'] : '';
  const date = typeof fiche?.['date'] === 'string' ? fiche['date'] : '';
  return {
    id: identifiantAlbumDepot(album),
    titre:
      (typeof fiche?.['titre'] === 'string' ? fiche['titre'] : '') ||
      titreDepuisNomFichier(album.dossier),
    artiste: typeof fiche?.['artiste'] === 'string' ? fiche['artiste'] : '',
    type: (TYPES.includes(type) ? type : deduireTypeAlbum(listees.length)) as TypeAlbum,
    categorie: album.categorie,
    ...(/^\d{4}/.test(date) && { annee: date.slice(0, 4) }),
    nombrePistes: listees.length,
    visible: fiche?.['visible'] !== false,
    incomplet: listees.some((nom) => !presentes.has(nom)),
    illisible: fiche === undefined,
    album,
  };
}

export interface CriteresAlbums {
  recherche: string;
  type: '' | TypeAlbum;
  categorie: string;
  annee: string;
}

/** Années présentes dans la liste, de la plus récente à la plus ancienne. */
export function anneesDesAlbums(lignes: readonly LigneAlbum[]): string[] {
  return [...new Set(lignes.flatMap((l) => (l.annee === undefined ? [] : [l.annee])))].sort(
    (a, b) => b.localeCompare(a),
  );
}

/** Albums qui répondent à la recherche (titre, artiste, catégorie) et aux filtres, triés par titre. */
export function filtrerAlbums(
  lignes: readonly LigneAlbum[],
  criteres: CriteresAlbums,
  langue = 'en',
): LigneAlbum[] {
  const mots = normaliser(criteres.recherche)
    .split(' ')
    .filter((m) => m !== '');
  const collateur = new Intl.Collator(langue, { sensitivity: 'base', numeric: true });
  return lignes
    .filter((ligne) => {
      if (criteres.type !== '' && ligne.type !== criteres.type) return false;
      if (criteres.categorie !== '' && ligne.categorie !== criteres.categorie) return false;
      if (criteres.annee !== '' && ligne.annee !== criteres.annee) return false;
      const foin = normaliser([ligne.titre, ligne.artiste, ligne.categorie].join(' '));
      return mots.every((mot) => foin.includes(mot));
    })
    .sort((a, b) => collateur.compare(a.titre, b.titre) || a.id.localeCompare(b.id));
}
