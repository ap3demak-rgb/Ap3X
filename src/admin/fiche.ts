// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  ANNEE_COPYRIGHT_PAR_DEFAUT,
  ARTISTE_PAR_DEFAUT,
  FichePisteSchema,
  LICENCE_PAR_DEFAUT,
} from '../catalogue/schemas';
import { normaliserDate, normaliserHashtag, slugifier } from '../catalogue/texte';
import { DOSSIER_MUSIQUE, identifiantPisteDepot, type AnalyseDepot } from './depot';

/** Données saisies pour une nouvelle piste. */
export interface FormulairePiste {
  titre: string;
  artiste: string;
  description: string;
  /** Dossier de la catégorie (existante, ou nom d'une nouvelle). */
  categorie: string;
  /** Hashtags séparés par des espaces ou des virgules, avec ou sans « # ». */
  hashtags: string;
  date: string;
  /** Faux : brouillon, enregistré mais absent du catalogue public. */
  visible: boolean;
  telechargement: boolean;
  licence: string;
  copyright: string;
}

export type ChampInvalide = 'fichier' | 'titre' | 'categorie' | 'date' | 'doublon';

export interface ErreurFormulaire {
  champ: ChampInvalide;
  /** Identifiant déjà pris, pour `doublon`. */
  id?: string;
}

/** Hashtags d'une saisie libre : sans « # », en minuscules, sans doublon. */
export function lireHashtags(saisie: string): string[] {
  const vus = new Set<string>();
  for (const morceau of saisie.split(/[\s,;]+/)) {
    const hashtag = normaliserHashtag(morceau);
    if (hashtag !== '') vus.add(hashtag);
  }
  return [...vus];
}

/** Nom de dossier d'une catégorie saisie librement (« Deep House » donne « deep-house »). */
export function dossierCategorie(saisie: string, existantes: readonly string[]): string {
  const propre = saisie.trim();
  const exacte = existantes.find((d) => d === propre);
  if (exacte !== undefined) return exacte;
  return slugifier(propre);
}

/** Nom de fichier (sans extension) d'une nouvelle piste : le titre, sous forme de slug. */
export function nomFichierPiste(titre: string): string {
  return slugifier(titre) || 'piste';
}

export interface CheminsPiste {
  dossier: string;
  mp3: string;
  fiche: string;
  /** Chemin de l'image de pochette pour une extension donnée (`.webp`, `.jpg`…). */
  image: (extension: string) => string;
}

export function cheminsPiste(categorie: string, base: string): CheminsPiste {
  const dossier = `${DOSSIER_MUSIQUE}/${categorie}`;
  return {
    dossier,
    mp3: `${dossier}/${base}.mp3`,
    fiche: `${dossier}/${base}.json`,
    image: (extension) => `${dossier}/${base}${extension}`,
  };
}

/** Vérifie le formulaire et les collisions avec le dépôt ; liste vide si tout est correct. */
export function verifierFormulaire(
  formulaire: FormulairePiste,
  aUnFichier: boolean,
  depot: AnalyseDepot,
): ErreurFormulaire[] {
  const erreurs: ErreurFormulaire[] = [];
  if (!aUnFichier) erreurs.push({ champ: 'fichier' });
  if (formulaire.titre.trim() === '') erreurs.push({ champ: 'titre' });
  const categorie = dossierCategorie(formulaire.categorie, depot.categories);
  if (categorie === '') erreurs.push({ champ: 'categorie' });
  const date = formulaire.date.trim();
  if (date !== '' && normaliserDate(date) !== date) erreurs.push({ champ: 'date' });
  if (erreurs.length === 0) {
    const base = nomFichierPiste(formulaire.titre);
    const id = identifiantPisteDepot({ categorie, base });
    const pris = new Set(depot.pistes.map(identifiantPisteDepot));
    if (pris.has(id) || depot.chemins.has(cheminsPiste(categorie, base).mp3)) {
      erreurs.push({ champ: 'doublon', id });
    }
  }
  return erreurs;
}

/**
 * Contenu de la fiche JSON d'une piste : seuls les champs utiles sont écrits (les valeurs par défaut du
 * schéma restent implicites). La fiche est validée avec le schéma partagé avec le générateur du catalogue.
 */
export function construireFiche(formulaire: FormulairePiste, pochette?: string): string {
  const hashtags = lireHashtags(formulaire.hashtags);
  const brute: Record<string, unknown> = {
    titre: formulaire.titre.trim(),
    ...(formulaire.artiste.trim() !== '' && { artiste: formulaire.artiste.trim() }),
    ...(formulaire.description.trim() !== '' && { description: formulaire.description.trim() }),
    ...(hashtags.length > 0 && { hashtags }),
    ...(pochette !== undefined && { pochette }),
    ...(formulaire.date.trim() !== '' && { date: formulaire.date.trim() }),
    ...(!formulaire.visible && { visible: false }),
    ...(formulaire.telechargement && { telechargement: true }),
    ...(formulaire.licence.trim() !== '' &&
      formulaire.licence.trim() !== LICENCE_PAR_DEFAUT && { licence: formulaire.licence.trim() }),
    ...(formulaire.copyright.trim() !== '' && { copyright: formulaire.copyright.trim() }),
  };
  FichePisteSchema.parse(brute);
  return `${JSON.stringify(brute, null, 2)}\n`;
}

/** Valeurs initiales d'un formulaire : artiste, licence et copyright par défaut du projet. */
export function formulaireVide(categorie = ''): FormulairePiste {
  return {
    titre: '',
    artiste: ARTISTE_PAR_DEFAUT,
    description: '',
    categorie,
    hashtags: '',
    date: '',
    visible: true,
    telechargement: false,
    licence: LICENCE_PAR_DEFAUT,
    copyright: `© ${ANNEE_COPYRIGHT_PAR_DEFAUT} ${ARTISTE_PAR_DEFAUT}`,
  };
}
