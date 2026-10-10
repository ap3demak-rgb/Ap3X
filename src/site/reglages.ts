// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { DESCRIPTION_SITE, NOM_SITE } from '../constantes';

/** Entrées du menu principal qu'on peut masquer. */
export const ENTREES_MENU = ['categories', 'albums', 'playlists', 'favoris', 'licences'] as const;
export type EntreeMenu = (typeof ENTREES_MENU)[number];

export interface LienSite {
  nom: string;
  url: string;
}

/**
 * Réglages du site, écrits dans `public/site.json` (modifiables depuis la page d'administration). Ils sont
 * lus au build, validés par `src/site/schema.ts`, et insérés dans `index.html` : le site les a dès le
 * premier affichage, sans requête supplémentaire.
 */
export interface Reglages {
  version: 1;
  nom: string;
  /** Phrase d'accroche affichée sous le titre de la page d'accueil (vide : aucune). */
  slogan: string;
  /** Description pour les moteurs de recherche et les aperçus de partage. */
  description: string;
  /** Liens vers d'autres sites (réseaux, boutique…), affichés dans le pied de page. */
  liens: LienSite[];
  options: {
    /** Interrupteur général : faux masque tous les téléchargements, quelles que soient les fiches. */
    telechargements: boolean;
    /** Lecture aléatoire activée au premier passage d'un visiteur. */
    aleatoire: boolean;
  };
  accueil: {
    /** Identifiants de pistes ou d'albums mis en avant en haut de la page d'accueil. */
    misesEnAvant: string[];
  };
  fond: {
    /** Faux : pas d'animation 3D (même rendu que « mouvement réduit »). */
    actif: boolean;
    /** De 0 à 1 : part de la couleur maximale du thème utilisée (le contraste reste garanti). */
    intensite: number;
    /** Vitesse de l'animation, de 0,25 à 4 (1 = vitesse d'origine). */
    vitesse: number;
    /** Bandeau du visualiseur audio sous l'en-tête. */
    visualiseur: boolean;
  };
  menu: {
    masques: EntreeMenu[];
  };
}

export const LIMITES_FOND = {
  intensiteMin: 0,
  intensiteMax: 1,
  vitesseMin: 0.25,
  vitesseMax: 4,
} as const;

export function reglagesParDefaut(): Reglages {
  return {
    version: 1,
    nom: NOM_SITE,
    slogan: '',
    description: DESCRIPTION_SITE,
    liens: [],
    options: { telechargements: true, aleatoire: false },
    accueil: { misesEnAvant: [] },
    fond: { actif: true, intensite: 1, vitesse: 1, visualiseur: true },
    menu: { masques: [] },
  };
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);
const texte = (v: unknown, defaut: string): string =>
  typeof v === 'string' && v.trim() !== '' ? v.trim() : defaut;
const booleen = (v: unknown, defaut: boolean): boolean => (typeof v === 'boolean' ? v : defaut);
const nombre = (v: unknown, defaut: number, min: number, max: number): number =>
  typeof v === 'number' && Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : defaut;

/** Adresse http(s) ou mailto valide, sinon `undefined`. */
export function adresseLien(brut: string): string | undefined {
  try {
    const url = new URL(brut);
    return ['http:', 'https:', 'mailto:'].includes(url.protocol) ? url.href : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Lecture tolérante : une valeur absente ou invalide reprend sa valeur par défaut, le site ne plante
 * jamais à cause de ce fichier (la validation stricte est faite au build et dans l'administration).
 */
export function lireReglages(brut: unknown): Reglages {
  const defaut = reglagesParDefaut();
  if (!estObjet(brut)) return defaut;
  const options = estObjet(brut['options']) ? brut['options'] : {};
  const accueil = estObjet(brut['accueil']) ? brut['accueil'] : {};
  const fond = estObjet(brut['fond']) ? brut['fond'] : {};
  const menu = estObjet(brut['menu']) ? brut['menu'] : {};
  const liens = Array.isArray(brut['liens']) ? brut['liens'] : [];
  const misesEnAvant = Array.isArray(accueil['misesEnAvant']) ? accueil['misesEnAvant'] : [];
  const masques = Array.isArray(menu['masques']) ? menu['masques'] : [];
  return {
    version: 1,
    nom: texte(brut['nom'], defaut.nom),
    slogan: typeof brut['slogan'] === 'string' ? brut['slogan'].trim() : '',
    description: texte(brut['description'], defaut.description),
    liens: liens.flatMap((lien): LienSite[] => {
      if (!estObjet(lien)) return [];
      const nom = texte(lien['nom'], '');
      const url = typeof lien['url'] === 'string' ? adresseLien(lien['url']) : undefined;
      return nom !== '' && url !== undefined ? [{ nom, url }] : [];
    }),
    options: {
      telechargements: booleen(options['telechargements'], defaut.options.telechargements),
      aleatoire: booleen(options['aleatoire'], defaut.options.aleatoire),
    },
    accueil: {
      misesEnAvant: misesEnAvant.filter((id): id is string => typeof id === 'string' && id !== ''),
    },
    fond: {
      actif: booleen(fond['actif'], defaut.fond.actif),
      intensite: nombre(
        fond['intensite'],
        defaut.fond.intensite,
        LIMITES_FOND.intensiteMin,
        LIMITES_FOND.intensiteMax,
      ),
      vitesse: nombre(
        fond['vitesse'],
        defaut.fond.vitesse,
        LIMITES_FOND.vitesseMin,
        LIMITES_FOND.vitesseMax,
      ),
      visualiseur: booleen(fond['visualiseur'], defaut.fond.visualiseur),
    },
    menu: {
      masques: masques.filter((m): m is EntreeMenu =>
        (ENTREES_MENU as readonly unknown[]).includes(m),
      ),
    },
  };
}

/** Réglages actifs du site : remplacés une fois, au démarrage, par `chargerReglages()`. */
export const reglages: Reglages = reglagesParDefaut();

/** Identifiant de la balise `<script type="application/json">` insérée dans index.html au build. */
export const ID_BALISE_REGLAGES = 'reglages-site';

/** Lit les réglages insérés dans la page au build ; sans balise (tests, développement), les valeurs par défaut. */
export function chargerReglages(): void {
  const balise = document.getElementById(ID_BALISE_REGLAGES);
  let brut: unknown;
  try {
    brut = balise === null ? undefined : JSON.parse(balise.textContent ?? '');
  } catch {
    brut = undefined;
  }
  Object.assign(reglages, lireReglages(brut));
}

// Chargés dès l'import : les modules qui lisent `reglages` (traductions, lecteur, 3D) les trouvent prêts.
if (typeof document !== 'undefined') chargerReglages();
