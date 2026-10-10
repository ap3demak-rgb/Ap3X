// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { normaliser } from '../catalogue/recherche';
import { titreDepuisNomFichier } from '../catalogue/texte';
import { identifiantPisteDepot, type PisteDepot } from './depot';

/** Ce que la liste d'administration affiche d'une piste : le dépôt et sa fiche. */
export interface LignePiste {
  id: string;
  titre: string;
  artiste: string;
  categorie: string;
  album?: string;
  hashtags: string[];
  /** Faux pour un brouillon. */
  visible: boolean;
  piste: PisteDepot;
}

export type TriListe = 'titre' | 'categorie';

export interface CriteresListe {
  recherche: string;
  /** Dossier de catégorie, ou chaîne vide pour toutes. */
  categorie: string;
  hashtag: string;
  tri: TriListe;
}

export interface ResumeFiche {
  titre?: string;
  artiste?: string;
  hashtags: string[];
  visible: boolean;
}

/** Lecture tolérante d'une fiche : une fiche illisible donne un résumé vide plutôt qu'une erreur. */
export function lireResumeFiche(texte: string): ResumeFiche {
  try {
    const brut: unknown = JSON.parse(texte);
    if (typeof brut !== 'object' || brut === null) return { hashtags: [], visible: true };
    const fiche = brut as Record<string, unknown>;
    return {
      ...(typeof fiche['titre'] === 'string' && { titre: fiche['titre'] }),
      ...(typeof fiche['artiste'] === 'string' && { artiste: fiche['artiste'] }),
      hashtags: Array.isArray(fiche['hashtags'])
        ? fiche['hashtags'].filter((h): h is string => typeof h === 'string')
        : [],
      visible: fiche['visible'] !== false,
    };
  } catch {
    return { hashtags: [], visible: true };
  }
}

export function lignePiste(piste: PisteDepot, resume?: ResumeFiche): LignePiste {
  return {
    id: identifiantPisteDepot(piste),
    titre: resume?.titre ?? titreDepuisNomFichier(piste.base),
    artiste: resume?.artiste ?? '',
    categorie: piste.categorie,
    ...(piste.album !== undefined && { album: piste.album }),
    hashtags: resume?.hashtags ?? [],
    visible: resume?.visible ?? true,
    piste,
  };
}

/** Hashtags présents dans la liste, du plus utilisé au moins utilisé (puis par ordre alphabétique). */
export function hashtagsDeLaListe(lignes: readonly LignePiste[]): string[] {
  const comptes = new Map<string, number>();
  for (const ligne of lignes) {
    for (const hashtag of ligne.hashtags) comptes.set(hashtag, (comptes.get(hashtag) ?? 0) + 1);
  }
  return [...comptes.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([hashtag]) => hashtag);
}

/** Pistes qui répondent à la recherche (titre, artiste, hashtags, catégorie) et aux filtres, triées. */
export function filtrerLignes(
  lignes: readonly LignePiste[],
  criteres: CriteresListe,
  langue = 'en',
): LignePiste[] {
  const mots = normaliser(criteres.recherche)
    .split(' ')
    .filter((m) => m !== '');
  const collateur = new Intl.Collator(langue, { sensitivity: 'base', numeric: true });
  return lignes
    .filter((ligne) => {
      if (criteres.categorie !== '' && ligne.categorie !== criteres.categorie) return false;
      if (criteres.hashtag !== '' && !ligne.hashtags.includes(criteres.hashtag)) return false;
      const foin = normaliser(
        [ligne.titre, ligne.artiste, ligne.categorie, ligne.album ?? '', ...ligne.hashtags].join(
          ' ',
        ),
      );
      return mots.every((mot) => foin.includes(mot));
    })
    .sort((a, b) => {
      if (criteres.tri === 'categorie') {
        const parCategorie = collateur.compare(a.categorie, b.categorie);
        if (parCategorie !== 0) return parCategorie;
      }
      return collateur.compare(a.titre, b.titre) || a.id.localeCompare(b.id);
    });
}
