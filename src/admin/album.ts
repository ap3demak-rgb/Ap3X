// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  FichePisteSchema,
  FicheAlbumSchema,
  LICENCE_PAR_DEFAUT,
  type TypeAlbum,
} from '../catalogue/schemas';
import { normaliserDate, slugifier, titreDepuisNomFichier } from '../catalogue/texte';
import {
  DOSSIER_MUSIQUE,
  identifiantAlbumDepot,
  identifiantPisteDepot,
  type AlbumDepot,
  type AnalyseDepot,
  type PisteDepot,
} from './depot';
import type { FicheBrute } from './edition';
import { dossierCategorie, lireHashtags } from './fiche';
import type { Ajout, Changement } from './github';

/** Taille au-delà de laquelle un envoi est découpé en plusieurs commits (octets de MP3 par commit). */
export const SEUIL_LOT_OCTETS = 25 * 1024 * 1024;

/** Données saisies pour un album. */
export interface FormulaireAlbum {
  titre: string;
  artiste: string;
  /** Vide : le type est déduit du nombre de pistes. */
  type: '' | TypeAlbum;
  date: string;
  description: string;
  /** Dossier de la catégorie (existante, ou nom d'une nouvelle). */
  categorie: string;
  hashtags: string;
  licence: string;
  copyright: string;
  reference: string;
  /** Faux : brouillon, absent du catalogue public. */
  visible: boolean;
  telechargement: boolean;
}

export function formulaireAlbumVide(categorie = ''): FormulaireAlbum {
  return {
    titre: '',
    artiste: '',
    type: '',
    date: '',
    description: '',
    categorie,
    hashtags: '',
    licence: LICENCE_PAR_DEFAUT,
    copyright: '',
    reference: '',
    visible: true,
    telechargement: false,
  };
}

/** D'où vient une piste de l'album. */
export type OrigineAlbum =
  | { type: 'nouvelle'; octets: Uint8Array }
  /** Déjà dans le dossier de cet album. */
  | { type: 'existante'; piste: PisteDepot; fiche: FicheBrute | undefined }
  /** Titre seul du dépôt, à rattacher à l'album (son fichier est déplacé). */
  | { type: 'publiee'; piste: PisteDepot; fiche: FicheBrute | undefined };

export interface PisteAlbum {
  /** Clé stable pour l'interface (ne change pas quand on réordonne). */
  cle: string;
  titre: string;
  /** Vide : l'artiste de l'album. */
  artiste: string;
  disque: number;
  origine: OrigineAlbum;
}

export type ChampAlbum =
  | 'titre'
  | 'categorie'
  | 'date'
  | 'doublon'
  | 'pistes'
  | 'titre_piste'
  | 'disque'
  | 'album'
  | 'deplacement'
  | 'retrait'
  | 'pochette';

export interface ErreurAlbum {
  champ: ChampAlbum;
  /** Identifiant ou chemin en cause. */
  id?: string;
  /** Clés des pistes en cause. */
  cles?: string[];
}

export interface LotCommit {
  message: string;
  changements: Changement[];
}

export type PlanAlbum =
  | { ok: true; lots: LotCommit[]; dossier: string; id: string }
  | { ok: false; erreurs: ErreurAlbum[] };

/** Même contenu, quel que soit l'ordre des clés. */
export function memeContenu(a: unknown, b: unknown): boolean {
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

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur : '');
const nomDe = (chemin: string): string => chemin.slice(chemin.lastIndexOf('/') + 1);
const extensionDe = (chemin: string): string => {
  const nom = nomDe(chemin);
  const point = nom.lastIndexOf('.');
  return point < 0 ? '' : nom.slice(point).toLowerCase();
};
const sansExtension = (nom: string): string => {
  const point = nom.lastIndexOf('.');
  return point < 0 ? nom : nom.slice(0, point);
};
const NOMS_POCHETTE = ['cover', 'pochette'];

/** Valeurs du formulaire d'un album existant, d'après son `album.json`. */
export function formulaireDepuisAlbum(album: AlbumDepot, fiche: FicheBrute): FormulaireAlbum {
  const hashtags = Array.isArray(fiche['hashtags'])
    ? (fiche['hashtags'] as unknown[]).filter((h): h is string => typeof h === 'string')
    : [];
  const type = texte(fiche['type']);
  return {
    titre: texte(fiche['titre']) || titreDepuisNomFichier(album.dossier),
    artiste: texte(fiche['artiste']),
    type: type === 'single' || type === 'ep' || type === 'lp' || type === 'compilation' ? type : '',
    date: texte(fiche['date']),
    description: texte(fiche['description']),
    categorie: album.categorie,
    hashtags: hashtags.map((h) => `#${h}`).join(' '),
    licence: texte(fiche['licence']) || LICENCE_PAR_DEFAUT,
    copyright: texte(fiche['copyright']),
    reference: texte(fiche['reference']),
    visible: fiche['visible'] !== false,
    telechargement: fiche['telechargement'] === true,
  };
}

/** Pistes d'un album existant, dans l'ordre de `album.json` (disque puis position), puis les fichiers non listés. */
export function pistesDepuisAlbum(
  album: AlbumDepot,
  fiche: FicheBrute,
  fichesPistes: ReadonlyMap<string, FicheBrute | undefined>,
): PisteAlbum[] {
  const entrees = Array.isArray(fiche['pistes']) ? (fiche['pistes'] as unknown[]) : [];
  const parNom = new Map(album.pistes.map((p) => [nomDe(p.mp3.chemin), p]));
  const resultat: PisteAlbum[] = [];
  const vus = new Set<string>();
  for (const entree of entrees) {
    const fichier =
      typeof entree === 'string' ? entree : texte((entree as FicheBrute)?.['fichier']);
    const disque =
      typeof entree === 'object' &&
      entree !== null &&
      typeof (entree as FicheBrute)['disque'] === 'number'
        ? ((entree as FicheBrute)['disque'] as number)
        : 1;
    const piste = parNom.get(fichier);
    if (piste === undefined || vus.has(fichier)) continue;
    vus.add(fichier);
    const fichePiste = fichesPistes.get(piste.mp3.chemin);
    resultat.push({
      cle: piste.mp3.chemin,
      titre: texte(fichePiste?.['titre']) || titreDepuisNomFichier(piste.base),
      artiste: texte(fichePiste?.['artiste']),
      disque,
      origine: { type: 'existante', piste, fiche: fichePiste },
    });
  }
  return resultat;
}

/** Noms de fichier (sans extension) des pistes : ceux du dépôt sont conservés, les nouveaux dérivent du titre. */
export function nomsDePistes(pistes: readonly PisteAlbum[]): Map<string, string> {
  const pris = new Set<string>();
  const noms = new Map<string, string>();
  for (const p of pistes) {
    if (p.origine.type === 'nouvelle') continue;
    noms.set(p.cle, p.origine.piste.base);
    pris.add(slugifier(p.origine.piste.base));
  }
  for (const p of pistes) {
    if (p.origine.type !== 'nouvelle') continue;
    const racine = slugifier(p.titre) || 'piste';
    let candidat = racine;
    for (let n = 2; pris.has(slugifier(candidat)); n += 1) candidat = `${racine}-${n}`;
    pris.add(slugifier(candidat));
    noms.set(p.cle, candidat);
  }
  return noms;
}

/** Durée totale en secondes et nombre de pistes ; le type suggéré se déduit du nombre de pistes. */
export function resumeAlbum(durees: readonly number[]): { pistes: number; duree: number } {
  return { pistes: durees.length, duree: durees.reduce((somme, d) => somme + d, 0) };
}

/** Fiche JSON d'un album, validée par le schéma partagé avec le générateur du catalogue. */
export function fusionnerFicheAlbum(
  existante: FicheBrute | undefined,
  formulaire: FormulaireAlbum,
  pistes: readonly PisteAlbum[],
  noms: ReadonlyMap<string, string>,
  options: { visible: boolean; pochette?: string | null },
): FicheBrute {
  const fiche: FicheBrute = { ...existante };
  const poser = (cle: string, valeur: unknown): void => {
    if (valeur === undefined) Reflect.deleteProperty(fiche, cle);
    else fiche[cle] = valeur;
  };
  const hashtags = lireHashtags(formulaire.hashtags);
  const licence = formulaire.licence.trim();
  poser('titre', formulaire.titre.trim());
  poser('artiste', formulaire.artiste.trim() || undefined);
  poser('type', formulaire.type === '' ? undefined : formulaire.type);
  poser('date', formulaire.date.trim() || undefined);
  poser('description', formulaire.description.trim() || undefined);
  poser('hashtags', hashtags.length > 0 ? hashtags : undefined);
  poser('licence', licence === '' || licence === LICENCE_PAR_DEFAUT ? undefined : licence);
  poser('copyright', formulaire.copyright.trim() || undefined);
  poser('reference', formulaire.reference.trim() || undefined);
  poser('visible', options.visible ? undefined : false);
  poser('telechargement', formulaire.telechargement ? true : undefined);
  if (options.pochette === null) poser('pochette', undefined);
  else if (options.pochette !== undefined) poser('pochette', options.pochette);
  poser(
    'pistes',
    pistes.map((p) => {
      const fichier = `${noms.get(p.cle) ?? ''}.mp3`;
      return p.disque === 1 ? fichier : { fichier, disque: p.disque };
    }),
  );
  return fiche;
}

export function serialiserFicheAlbum(fiche: FicheBrute): string {
  FicheAlbumSchema.parse(fiche);
  return `${JSON.stringify(fiche, null, 2)}\n`;
}

function serialiserFichePiste(fiche: FicheBrute): string {
  FichePisteSchema.parse(fiche);
  return `${JSON.stringify(fiche, null, 2)}\n`;
}

/** Fiche d'une piste avec son titre et son artiste du formulaire ; les autres champs sont conservés. */
function fichePisteMiseAJour(existante: FicheBrute | undefined, piste: PisteAlbum): FicheBrute {
  const fiche: FicheBrute = { ...existante, titre: piste.titre.trim() };
  if (piste.artiste.trim() === '') Reflect.deleteProperty(fiche, 'artiste');
  else fiche['artiste'] = piste.artiste.trim();
  return fiche;
}

/** Image qui sert de pochette à l'album : celle que déclare la fiche, sinon `cover.*` ou `pochette.*`. */
function pochetteAlbum(
  album: AlbumDepot,
  fiche: FicheBrute,
): { chemin: string; sha: string } | undefined {
  const declaree = texte(fiche['pochette']);
  const images = album.images;
  if (declaree !== '') {
    const trouvee = images.find((i) => nomDe(i.chemin) === declaree);
    if (trouvee !== undefined) return trouvee;
  }
  return images.find((i) => NOMS_POCHETTE.includes(sansExtension(nomDe(i.chemin)).toLowerCase()));
}

interface Reservations {
  chemins: Set<string>;
  ids: Set<string>;
}

/**
 * Changements qui font redevenir une piste d'album un titre seul de la catégorie `categorie` : le MP3, la
 * fiche et l'image sont déplacés (sans être renvoyés). Une piste sans image propre reçoit celle de l'album.
 */
function pisteVersTitreSeul(
  piste: PisteDepot,
  fiche: FicheBrute | undefined,
  categorie: string,
  pochetteDeLAlbum: { chemin: string; sha: string } | undefined,
  depot: AnalyseDepot,
  reservations: Reservations,
  traitesSource: Set<string>,
): { changements: Changement[] } | { erreur: ErreurAlbum } {
  const dossier = `${DOSSIER_MUSIQUE}/${categorie}`;
  const mp3Cible = `${dossier}/${piste.base}.mp3`;
  const id = identifiantPisteDepot({ categorie, base: piste.base });
  const pris =
    depot.pistes.some((p) => p.album === undefined && identifiantPisteDepot(p) === id) ||
    depot.chemins.has(mp3Cible) ||
    reservations.ids.has(id) ||
    reservations.chemins.has(mp3Cible);
  if (pris) return { erreur: { champ: 'retrait', id } };
  reservations.ids.add(id);
  reservations.chemins.add(mp3Cible);

  const changements: Changement[] = [
    { chemin: mp3Cible, sha: piste.mp3.sha },
    { chemin: piste.mp3.chemin, supprimer: true },
  ];
  traitesSource.add(piste.mp3.chemin);
  const nouvelle: FicheBrute = { ...fiche };
  const imageCible = (extension: string): string => `${dossier}/${piste.base}${extension}`;
  if (piste.image !== undefined) {
    const ext = extensionDe(piste.image.chemin);
    changements.push({ chemin: imageCible(ext), sha: piste.image.sha });
    changements.push({ chemin: piste.image.chemin, supprimer: true });
    traitesSource.add(piste.image.chemin);
    nouvelle['pochette'] = `${piste.base}${ext}`;
  } else if (pochetteDeLAlbum !== undefined) {
    const ext = extensionDe(pochetteDeLAlbum.chemin);
    changements.push({ chemin: imageCible(ext), sha: pochetteDeLAlbum.sha });
    nouvelle['pochette'] = `${piste.base}${ext}`;
  } else {
    Reflect.deleteProperty(nouvelle, 'pochette');
  }
  if (piste.fiche !== undefined) {
    changements.push({ chemin: piste.fiche.chemin, supprimer: true });
    traitesSource.add(piste.fiche.chemin);
  }
  if (piste.fiche !== undefined || Object.keys(nouvelle).length > 0) {
    changements.push({
      chemin: `${dossier}/${piste.base}.json`,
      contenu: serialiserFichePiste(nouvelle),
    });
  }
  return { changements };
}

export interface EntreeAlbum {
  formulaire: FormulaireAlbum;
  pistes: PisteAlbum[];
  /** Nouvelle pochette de l'album (déjà redimensionnée). */
  pochette?: { octets: Uint8Array; extension: string };
  /** Album à modifier ; absent pour une création. */
  existant?: {
    album: AlbumDepot;
    fiche: FicheBrute;
    /** Fiches de toutes les pistes de l'album (clé : chemin du MP3), y compris celles qu'on retire. */
    fichesPistes: ReadonlyMap<string, FicheBrute | undefined>;
  };
  depot: AnalyseDepot;
  /** Octets de MP3 par commit au-delà desquels l'envoi est découpé. */
  seuilLot?: number;
}

function messageAlbum(
  formulaire: FormulaireAlbum,
  existant: EntreeAlbum['existant'],
  deplace: boolean,
  categorie: string,
): string {
  const titre = formulaire.titre.trim();
  if (existant === undefined) {
    return formulaire.visible
      ? `ajout: album « ${titre} »`
      : `ajout: brouillon d'album « ${titre} »`;
  }
  if (deplace) return `déplacement: album « ${titre} » vers ${categorie}`;
  const etait = existant.fiche['visible'] !== false;
  if (!etait && formulaire.visible) return `publication: album « ${titre} »`;
  if (etait && !formulaire.visible) return `masquage: album « ${titre} »`;
  return `modification: album « ${titre} »`;
}

/**
 * Plan de publication d'un album (création ou modification) : les changements, répartis en un ou plusieurs
 * commits. Au-delà de `seuilLot` octets de MP3, l'envoi est découpé : un premier commit pose la structure
 * avec un album masqué, des commits suivants envoient les MP3 par paquets, un dernier rend l'album
 * visible. Ainsi, une coupure en cours de route ne casse jamais le build du site (un dossier de MP3 sans
 * `album.json` est une erreur du générateur) et l'envoi peut reprendre au commit interrompu.
 */
export function planAlbum(entree: EntreeAlbum): PlanAlbum {
  const { formulaire, pistes, depot, existant } = entree;
  const erreurs: ErreurAlbum[] = [];
  if (formulaire.titre.trim() === '') erreurs.push({ champ: 'titre' });
  const categorie = dossierCategorie(formulaire.categorie, depot.categories);
  if (categorie === '') erreurs.push({ champ: 'categorie' });
  const date = formulaire.date.trim();
  if (date !== '' && normaliserDate(date) !== date) erreurs.push({ champ: 'date' });
  if (pistes.length === 0) erreurs.push({ champ: 'pistes' });
  const sansTitre = pistes.filter((p) => p.titre.trim() === '').map((p) => p.cle);
  if (sansTitre.length > 0) erreurs.push({ champ: 'titre_piste', cles: sansTitre });
  const disquesInvalides = pistes
    .filter((p) => !Number.isInteger(p.disque) || p.disque < 1)
    .map((p) => p.cle);
  if (disquesInvalides.length > 0) erreurs.push({ champ: 'disque', cles: disquesInvalides });
  // Un album publié a une pochette (la sienne, ou celle déjà présente dans son dossier).
  const aPochette =
    entree.pochette !== undefined ||
    (existant !== undefined && pochetteAlbum(existant.album, existant.fiche) !== undefined);
  if (formulaire.visible && !aPochette) erreurs.push({ champ: 'pochette' });
  if (erreurs.length > 0) return { ok: false, erreurs };

  const dossier = existant?.album.dossier ?? (slugifier(formulaire.titre) || 'album');
  const deplace = existant !== undefined && categorie !== existant.album.categorie;
  const racineCible = `${DOSSIER_MUSIQUE}/${categorie}/${dossier}`;
  const idAlbum = identifiantAlbumDepot({ categorie, dossier });

  if (existant === undefined || deplace) {
    const pris =
      depot.albums.some((a) => a !== existant?.album && identifiantAlbumDepot(a) === idAlbum) ||
      [...depot.chemins].some((c) => c.startsWith(`${racineCible}/`));
    if (pris) return { ok: false, erreurs: [{ champ: 'doublon', id: idAlbum }] };
  }

  const noms = nomsDePistes(pistes);
  const structurel: Changement[] = [];
  const envois: Ajout[] = [];
  const traitesSource = new Set<string>();
  const reservations: Reservations = { chemins: new Set(), ids: new Set() };
  /** Chemin d'un fichier de l'album une fois l'album dans son dossier cible. */
  const cheminCible = (chemin: string): string => `${racineCible}/${nomDe(chemin)}`;

  for (const piste of pistes) {
    const base = noms.get(piste.cle) ?? '';
    const mp3Cible = `${racineCible}/${base}.mp3`;
    const ficheCible = `${racineCible}/${base}.json`;
    const origine = piste.origine;

    if (origine.type === 'nouvelle') {
      envois.push({ chemin: mp3Cible, contenu: origine.octets });
      structurel.push({
        chemin: ficheCible,
        contenu: serialiserFichePiste(fichePisteMiseAJour(undefined, piste)),
      });
      continue;
    }

    const source = origine.piste;
    if (origine.type === 'publiee') {
      const declaree = texte(origine.fiche?.['pochette']);
      const nomImage = source.image === undefined ? undefined : nomDe(source.image.chemin);
      if (declaree !== '' && declaree !== nomImage) {
        return { ok: false, erreurs: [{ champ: 'deplacement', cles: [piste.cle] }] };
      }
      if (depot.chemins.has(mp3Cible)) {
        return { ok: false, erreurs: [{ champ: 'doublon', id: mp3Cible, cles: [piste.cle] }] };
      }
    }

    const bouge = origine.type === 'publiee' || deplace;
    if (bouge) {
      structurel.push({ chemin: mp3Cible, sha: source.mp3.sha });
      structurel.push({ chemin: source.mp3.chemin, supprimer: true });
    }
    traitesSource.add(source.mp3.chemin);

    const fiche = fichePisteMiseAJour(origine.fiche, piste);
    const ficheModifiee =
      origine.fiche === undefined
        ? piste.titre.trim() !== titreDepuisNomFichier(source.base) || piste.artiste.trim() !== ''
        : !memeContenu(origine.fiche, fiche);
    if (ficheModifiee || (bouge && source.fiche !== undefined)) {
      structurel.push({ chemin: ficheCible, contenu: serialiserFichePiste(fiche) });
    }
    if (bouge && source.fiche !== undefined) {
      structurel.push({ chemin: source.fiche.chemin, supprimer: true });
    }
    if (source.fiche !== undefined) traitesSource.add(source.fiche.chemin);

    if (source.image !== undefined) {
      if (bouge) {
        structurel.push({
          chemin: `${racineCible}/${base}${extensionDe(source.image.chemin)}`,
          sha: source.image.sha,
        });
        structurel.push({ chemin: source.image.chemin, supprimer: true });
      }
      traitesSource.add(source.image.chemin);
    }
  }

  // Pistes retirées de l'album : elles redeviennent des titres seuls de la catégorie de l'album.
  let pochetteActuelle: { chemin: string; sha: string } | undefined;
  if (existant !== undefined) {
    pochetteActuelle = pochetteAlbum(existant.album, existant.fiche);
    const gardees = new Set(
      pistes.flatMap((p) => (p.origine.type === 'existante' ? [p.origine.piste] : [])),
    );
    for (const piste of existant.album.pistes) {
      if (gardees.has(piste)) continue;
      const resultat = pisteVersTitreSeul(
        piste,
        existant.fichesPistes.get(piste.mp3.chemin),
        categorie,
        pochetteActuelle,
        depot,
        reservations,
        traitesSource,
      );
      if ('erreur' in resultat) return { ok: false, erreurs: [resultat.erreur] };
      structurel.push(...resultat.changements);
    }
  }

  // Pochette de l'album.
  let pochetteFiche: string | null | undefined;
  if (entree.pochette !== undefined) {
    const cible = `${racineCible}/cover${entree.pochette.extension}`;
    structurel.push({ chemin: cible, contenu: entree.pochette.octets });
    if (existant !== undefined) {
      for (const image of existant.album.images) {
        const nom = sansExtension(nomDe(image.chemin)).toLowerCase();
        const estPochette =
          NOMS_POCHETTE.includes(nom) || nomDe(image.chemin) === texte(existant.fiche['pochette']);
        if (estPochette && !traitesSource.has(image.chemin)) {
          traitesSource.add(image.chemin);
          // Écrasée sur place si c'est le même chemin, supprimée sinon.
          if (image.chemin !== cible) structurel.push({ chemin: image.chemin, supprimer: true });
        }
      }
    }
    // Le fichier `cover.*` est trouvé automatiquement : plus de déclaration dans la fiche.
    pochetteFiche = null;
  }

  // Album déplacé : tout le reste du dossier suit, sans être renvoyé.
  if (existant !== undefined && deplace) {
    for (const fichier of existant.album.fichiers) {
      if (traitesSource.has(fichier.chemin) || fichier.chemin === existant.album.fiche.chemin)
        continue;
      structurel.push({ chemin: cheminCible(fichier.chemin), sha: fichier.sha });
      structurel.push({ chemin: fichier.chemin, supprimer: true });
    }
  }

  // album.json
  const ficheFinale = fusionnerFicheAlbum(existant?.fiche, formulaire, pistes, noms, {
    visible: formulaire.visible,
    ...(pochetteFiche !== undefined && { pochette: pochetteFiche }),
  });
  const albumJsonChange =
    existant === undefined || deplace || !memeContenu(existant.fiche, ficheFinale);
  const cheminAlbumJson = `${racineCible}/album.json`;
  const textFinal = serialiserFicheAlbum(ficheFinale);
  const textMasque = serialiserFicheAlbum({ ...ficheFinale, visible: false });
  if (deplace && existant !== undefined) {
    structurel.push({ chemin: existant.album.fiche.chemin, supprimer: true });
  }

  if (structurel.length === 0 && envois.length === 0 && !albumJsonChange) {
    return { ok: true, lots: [], dossier, id: idAlbum };
  }

  const message = messageAlbum(formulaire, existant, deplace, categorie);
  const seuil = entree.seuilLot ?? SEUIL_LOT_OCTETS;
  const total = envois.reduce((somme, a) => somme + a.contenu.length, 0);

  if (total <= seuil) {
    return {
      ok: true,
      lots: [
        {
          message,
          changements: [
            ...structurel,
            ...(albumJsonChange ? [{ chemin: cheminAlbumJson, contenu: textFinal }] : []),
            ...envois,
          ],
        },
      ],
      dossier,
      id: idAlbum,
    };
  }

  // Envoi découpé : structure + album masqué, puis les MP3 par paquets, puis l'album tel qu'attendu.
  const paquets: Ajout[][] = [];
  let courant: Ajout[] = [];
  let taille = 0;
  for (const envoi of envois) {
    const octets = envoi.contenu.length;
    if (courant.length > 0 && taille + octets > seuil) {
      paquets.push(courant);
      courant = [];
      taille = 0;
    }
    courant.push(envoi);
    taille += octets;
  }
  if (courant.length > 0) paquets.push(courant);

  const lots: LotCommit[] = [
    {
      message,
      changements: [...structurel, { chemin: cheminAlbumJson, contenu: textMasque }],
    },
    ...paquets.map((paquet) => ({ message, changements: paquet })),
  ];
  if (formulaire.visible) {
    lots.push({ message, changements: [{ chemin: cheminAlbumJson, contenu: textFinal }] });
  }
  const n = lots.length;
  return {
    ok: true,
    lots: lots.map((lot, i) => ({ ...lot, message: `${lot.message} [${i + 1}/${n}]` })),
    dossier,
    id: idAlbum,
  };
}

export type ModeSuppressionAlbum = 'tout' | 'conserver';

export type PlanSuppressionAlbum =
  { ok: true; changements: Changement[]; message: string } | { ok: false; erreurs: ErreurAlbum[] };

/**
 * Suppression d'un album : tout le dossier est retiré (`tout`), ou bien les pistes sont d'abord déplacées
 * dans la catégorie comme titres seuls (`conserver`), avec la pochette de l'album si elles n'en ont pas.
 */
export function planSuppressionAlbum(
  album: AlbumDepot,
  fiche: FicheBrute,
  fichesPistes: ReadonlyMap<string, FicheBrute | undefined>,
  mode: ModeSuppressionAlbum,
  depot: AnalyseDepot,
): PlanSuppressionAlbum {
  const changements: Changement[] = [];
  const traites = new Set<string>();
  const titre = texte(fiche['titre']) || titreDepuisNomFichier(album.dossier);
  if (mode === 'conserver') {
    const reservations: Reservations = { chemins: new Set(), ids: new Set() };
    const pochette = pochetteAlbum(album, fiche);
    const erreurs: ErreurAlbum[] = [];
    for (const piste of album.pistes) {
      const resultat = pisteVersTitreSeul(
        piste,
        fichesPistes.get(piste.mp3.chemin),
        album.categorie,
        pochette,
        depot,
        reservations,
        traites,
      );
      if ('erreur' in resultat) erreurs.push(resultat.erreur);
      else changements.push(...resultat.changements);
    }
    if (erreurs.length > 0) return { ok: false, erreurs };
  }
  for (const fichier of album.fichiers) {
    if (!traites.has(fichier.chemin)) changements.push({ chemin: fichier.chemin, supprimer: true });
  }
  return {
    ok: true,
    changements,
    message:
      mode === 'tout'
        ? `suppression: album « ${titre} » et ses pistes`
        : `suppression: album « ${titre} » (pistes conservées)`,
  };
}
