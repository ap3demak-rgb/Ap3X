// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { FichePisteSchema, LICENCE_PAR_DEFAUT } from '../catalogue/schemas';
import { normaliserDate, titreDepuisNomFichier } from '../catalogue/texte';
import { identifiantPisteDepot, type AnalyseDepot, type PisteDepot } from './depot';
import {
  cheminsPiste,
  dossierCategorie,
  lireHashtags,
  type ErreurFormulaire,
  type FormulairePiste,
} from './fiche';
import type { Changement } from './github';
import type { LignePiste } from './liste';

/** Contenu d'une fiche JSON lue telle quelle : les champs inconnus du formulaire sont conservés. */
export type FicheBrute = Record<string, unknown>;

/** Erreurs propres à la modification, en plus de celles du formulaire. */
export type ErreurEdition = ErreurFormulaire | { champ: 'deplacement' | 'album' };

export type PlanModification =
  | { ok: true; changements: Changement[]; message: string }
  | { ok: false; erreurs: ErreurEdition[] };

/** Une fiche JSON du dépôt n'est pas lisible : la modifier écraserait ses autres champs. */
export class ErreurFicheIllisible extends Error {
  constructor() {
    super('Fiche JSON illisible');
    this.name = 'ErreurFicheIllisible';
  }
}

/** Fiche JSON lue ; lève `ErreurFicheIllisible` si le texte n'est pas un objet JSON. */
export function lireFicheBrute(texte: string): FicheBrute {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch {
    throw new ErreurFicheIllisible();
  }
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    throw new ErreurFicheIllisible();
  }
  return brut as FicheBrute;
}

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur : '');

/** Valeurs du formulaire d'édition d'une piste existante, d'après sa fiche (absente : valeurs neutres). */
export function formulaireDepuisFiche(
  piste: PisteDepot,
  fiche: FicheBrute | undefined,
): FormulairePiste {
  const hashtags = Array.isArray(fiche?.['hashtags'])
    ? (fiche['hashtags'] as unknown[]).filter((h): h is string => typeof h === 'string')
    : [];
  return {
    titre: texte(fiche?.['titre']) || titreDepuisNomFichier(piste.base),
    artiste: texte(fiche?.['artiste']),
    description: texte(fiche?.['description']),
    categorie: piste.categorie,
    hashtags: hashtags.map((h) => `#${h}`).join(' '),
    date: texte(fiche?.['date']),
    visible: fiche?.['visible'] !== false,
    telechargement: fiche?.['telechargement'] === true,
    licence: texte(fiche?.['licence']) || LICENCE_PAR_DEFAUT,
    copyright: texte(fiche?.['copyright']),
  };
}

/** Pose `valeur` sous `cle`, ou retire la clé quand `valeur` est `undefined`. */
function poser(fiche: FicheBrute, cle: string, valeur: unknown): void {
  if (valeur === undefined) Reflect.deleteProperty(fiche, cle);
  else fiche[cle] = valeur;
}

/**
 * Fiche mise à jour avec les champs du formulaire. Les champs que le formulaire ne gère pas
 * (catégories supplémentaires…) restent tels quels ; les valeurs par défaut du schéma sont omises.
 */
export function fusionnerFiche(
  existante: FicheBrute | undefined,
  formulaire: FormulairePiste,
  pochette?: string,
): FicheBrute {
  const fiche: FicheBrute = { ...existante };
  const hashtags = lireHashtags(formulaire.hashtags);
  const licence = formulaire.licence.trim();
  poser(fiche, 'titre', formulaire.titre.trim());
  poser(fiche, 'artiste', formulaire.artiste.trim() || undefined);
  poser(fiche, 'description', formulaire.description.trim() || undefined);
  poser(fiche, 'hashtags', hashtags.length > 0 ? hashtags : undefined);
  poser(fiche, 'date', formulaire.date.trim() || undefined);
  poser(fiche, 'visible', formulaire.visible ? undefined : false);
  poser(fiche, 'telechargement', formulaire.telechargement ? true : undefined);
  poser(fiche, 'licence', licence === '' || licence === LICENCE_PAR_DEFAUT ? undefined : licence);
  poser(fiche, 'copyright', formulaire.copyright.trim() || undefined);
  if (pochette !== undefined) fiche['pochette'] = pochette;
  return fiche;
}

/** Texte JSON d'une fiche, après validation par le schéma partagé avec le générateur du catalogue. */
export function serialiserFiche(fiche: FicheBrute): string {
  FichePisteSchema.parse(fiche);
  return `${JSON.stringify(fiche, null, 2)}\n`;
}

/** Même contenu, quel que soit l'ordre des clés. */
function memeContenu(a: unknown, b: unknown): boolean {
  const trier = (valeur: unknown): unknown => {
    if (Array.isArray(valeur)) return valeur.map(trier);
    if (typeof valeur === 'object' && valeur !== null) {
      return Object.fromEntries(
        Object.entries(valeur)
          .sort(([x], [y]) => x.localeCompare(y))
          .map(([cle, v]) => [cle, trier(v)]),
      );
    }
    return valeur;
  };
  return JSON.stringify(trier(a)) === JSON.stringify(trier(b));
}

const nomDe = (chemin: string): string => chemin.slice(chemin.lastIndexOf('/') + 1);

export interface EntreeModification {
  piste: PisteDepot;
  /** Fiche actuelle (`undefined` si la piste n'en a pas). */
  fiche: FicheBrute | undefined;
  formulaire: FormulairePiste;
  /** Nouveau fichier MP3 qui remplace l'ancien. */
  nouveauMp3?: Uint8Array;
  /** Nouvelle pochette (déjà redimensionnée) qui remplace l'ancienne image. */
  pochette?: { octets: Uint8Array; extension: string };
}

export interface ReservationsLot {
  ids: Set<string>;
  chemins: Set<string>;
}

/**
 * Changements à publier pour modifier une piste : fiche, remplacement du MP3 ou de l'image, déplacement
 * dans un autre dossier de catégorie (le contenu déjà présent est réutilisé, rien n'est renvoyé).
 * Une liste de changements vide signifie qu'il n'y a rien à enregistrer.
 */
export function planModification(
  entree: EntreeModification,
  depot: AnalyseDepot,
  reservations?: ReservationsLot,
): PlanModification {
  const { piste, fiche, formulaire } = entree;
  const erreurs: ErreurEdition[] = [];
  if (formulaire.titre.trim() === '') erreurs.push({ champ: 'titre' });
  const categorie = dossierCategorie(formulaire.categorie, depot.categories);
  if (categorie === '') erreurs.push({ champ: 'categorie' });
  const date = formulaire.date.trim();
  if (date !== '' && normaliserDate(date) !== date) erreurs.push({ champ: 'date' });
  if (erreurs.length > 0) return { ok: false, erreurs };

  const deplace = categorie !== piste.categorie;
  const nouveau = cheminsPiste(categorie, piste.base);
  const nomImage = piste.image === undefined ? undefined : nomDe(piste.image.chemin);

  if (deplace) {
    // Une piste d'album suit son album : on ne la déplace pas seule.
    if (piste.album !== undefined) return { ok: false, erreurs: [{ champ: 'album' }] };
    // Une fiche qui pointe vers une image partagée ne peut pas être déplacée sans casser le lien.
    const declaree = texte(fiche?.['pochette']);
    if (declaree !== '' && declaree !== nomImage) {
      return { ok: false, erreurs: [{ champ: 'deplacement' }] };
    }
    const id = identifiantPisteDepot({ categorie, base: piste.base });
    const pris =
      depot.pistes.some((p) => p !== piste && identifiantPisteDepot(p) === id) ||
      reservations?.ids.has(id) === true ||
      depot.chemins.has(nouveau.mp3) ||
      reservations?.chemins.has(nouveau.mp3) === true;
    if (pris) return { ok: false, erreurs: [{ champ: 'doublon', id } satisfies ErreurFormulaire] };
  }

  // Dossier réel de la piste (celui d'un album pour une piste d'album), pour les chemins existants.
  const dossierActuel = piste.mp3.chemin.slice(0, piste.mp3.chemin.lastIndexOf('/'));
  const cheminActuel = (nom: string): string => `${dossierActuel}/${nom}`;
  const mp3Cible = deplace ? nouveau.mp3 : piste.mp3.chemin;
  const ficheCible = deplace ? nouveau.fiche : cheminActuel(`${piste.base}.json`);
  const imageCible = (extension: string): string =>
    deplace ? nouveau.image(extension) : cheminActuel(`${piste.base}${extension}`);

  const nomPochette =
    entree.pochette === undefined ? undefined : `${piste.base}${entree.pochette.extension}`;
  const fusion = fusionnerFiche(fiche, { ...formulaire, categorie }, nomPochette);
  const texteFiche = serialiserFiche(fusion);

  const changements: Changement[] = [];
  // Sans fiche, le point de comparaison est la fiche qu'on déduirait du nom du fichier : rien à écrire
  // tant que le formulaire ne s'en écarte pas.
  const reference = fiche ?? fusionnerFiche(undefined, formulaireDepuisFiche(piste, undefined));
  const ficheChangee = !memeContenu(reference, fusion);
  if (ficheChangee || (deplace && piste.fiche !== undefined)) {
    changements.push({ chemin: ficheCible, contenu: texteFiche });
  }
  if (deplace && piste.fiche !== undefined) {
    changements.push({ chemin: piste.fiche.chemin, supprimer: true });
  }

  if (entree.nouveauMp3 !== undefined) {
    changements.push({ chemin: mp3Cible, contenu: entree.nouveauMp3 });
    if (deplace) changements.push({ chemin: piste.mp3.chemin, supprimer: true });
  } else if (deplace) {
    changements.push({ chemin: mp3Cible, sha: piste.mp3.sha });
    changements.push({ chemin: piste.mp3.chemin, supprimer: true });
  }

  if (entree.pochette !== undefined) {
    changements.push({
      chemin: imageCible(entree.pochette.extension),
      contenu: entree.pochette.octets,
    });
    // L'ancienne image est retirée si elle n'est pas écrasée par la nouvelle.
    if (piste.image !== undefined && piste.image.chemin !== imageCible(entree.pochette.extension)) {
      changements.push({ chemin: piste.image.chemin, supprimer: true });
    }
  } else if (deplace && piste.image !== undefined && nomImage !== undefined) {
    changements.push({ chemin: `${nouveau.dossier}/${nomImage}`, sha: piste.image.sha });
    changements.push({ chemin: piste.image.chemin, supprimer: true });
  }

  if (!ficheChangee && !deplace && changements.length === 0) {
    return { ok: true, changements: [], message: '' };
  }

  reservations?.ids.add(identifiantPisteDepot({ categorie, base: piste.base }));
  reservations?.chemins.add(mp3Cible);

  const titre = formulaire.titre.trim();
  const etait = fiche?.['visible'] !== false;
  let message = `modification: piste « ${titre} »`;
  if (deplace) message = `déplacement: piste « ${titre} » vers ${categorie}`;
  else if (!etait && formulaire.visible) message = `publication: piste « ${titre} »`;
  else if (etait && !formulaire.visible) message = `masquage: piste « ${titre} »`;
  return { ok: true, changements, message };
}

/** Pistes d'un album : elles ne se suppriment pas une à une ici. */
export interface PlanSuppression {
  changements: Changement[];
  message: string;
  /** Pistes ignorées parce qu'elles appartiennent à un album. */
  ignorees: LignePiste[];
}

/** Suppression de pistes : MP3, fiche et image du même nom, en un seul commit. */
export function planSuppression(lignes: readonly LignePiste[]): PlanSuppression {
  const changements: Changement[] = [];
  const ignorees: LignePiste[] = [];
  const retenues: LignePiste[] = [];
  for (const ligne of lignes) {
    if (ligne.piste.album !== undefined) {
      ignorees.push(ligne);
      continue;
    }
    retenues.push(ligne);
    changements.push({ chemin: ligne.piste.mp3.chemin, supprimer: true });
    if (ligne.piste.fiche !== undefined) {
      changements.push({ chemin: ligne.piste.fiche.chemin, supprimer: true });
    }
    if (ligne.piste.image !== undefined) {
      changements.push({ chemin: ligne.piste.image.chemin, supprimer: true });
    }
  }
  const message =
    retenues.length === 1
      ? `suppression: piste « ${retenues[0]?.titre ?? ''} »`
      : `suppression: ${retenues.length} pistes`;
  return { changements, message, ignorees };
}

export type ActionGroupee =
  | { type: 'categorie'; dossier: string }
  | { type: 'hashtag'; hashtag: string }
  | { type: 'visibilite'; visible: boolean };

export interface ResultatLot {
  changements: Changement[];
  message: string;
  /** Pistes modifiées. */
  modifiees: number;
  /** Pistes qui n'ont pas pu être traitées, avec la raison. */
  refusees: { ligne: LignePiste; erreurs: ErreurEdition[] }[];
}

/** Applique une même action à plusieurs pistes ; tout part dans un seul commit. */
export function planGroupe(
  lignes: readonly LignePiste[],
  fiches: ReadonlyMap<string, FicheBrute | undefined>,
  action: ActionGroupee,
  depot: AnalyseDepot,
): ResultatLot {
  const reservations: ReservationsLot = { ids: new Set(), chemins: new Set() };
  const changements: Changement[] = [];
  const refusees: ResultatLot['refusees'] = [];
  let modifiees = 0;
  for (const ligne of lignes) {
    const fiche = fiches.get(ligne.piste.mp3.chemin);
    const formulaire = formulaireDepuisFiche(ligne.piste, fiche);
    if (action.type === 'categorie') formulaire.categorie = action.dossier;
    else if (action.type === 'visibilite') formulaire.visible = action.visible;
    else {
      formulaire.hashtags = [...new Set([...lireHashtags(formulaire.hashtags), action.hashtag])]
        .map((h) => `#${h}`)
        .join(' ');
    }
    const plan = planModification({ piste: ligne.piste, fiche, formulaire }, depot, reservations);
    if (!plan.ok) refusees.push({ ligne, erreurs: plan.erreurs });
    else if (plan.changements.length > 0) {
      changements.push(...plan.changements);
      modifiees += 1;
    }
  }
  let detail: string;
  if (action.type === 'categorie') detail = `déplacement vers ${action.dossier}`;
  else if (action.type === 'hashtag') detail = `ajout du hashtag #${action.hashtag}`;
  else detail = action.visible ? 'publication' : 'masquage';
  return {
    changements,
    message: `modification: ${modifiees} pistes (${detail})`,
    modifiees,
    refusees,
  };
}
