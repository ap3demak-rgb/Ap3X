// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { CleI18n } from '../i18n';
import { ENTREES_MENU, LIMITES_FOND, reglagesParDefaut, type Reglages } from '../site/reglages';
import { ReglagesSchema } from '../site/schema';
import { identifiantAlbumDepot, identifiantPisteDepot, type AnalyseDepot } from './depot';

/** Chemin du fichier des réglages dans le dépôt. */
export const CHEMIN_REGLAGES = 'public/site.json';

/**
 * Description d'un champ du formulaire des réglages. Le formulaire est généré à partir de cette liste :
 * ajouter un réglage au schéma ne demande que d'ajouter une ligne ici.
 */
export type Descripteur =
  | { type: 'texte'; chemin: string; libelle: CleI18n; long?: boolean }
  | { type: 'case'; chemin: string; libelle: CleI18n }
  | { type: 'curseur'; chemin: string; libelle: CleI18n; min: number; max: number; pas: number }
  | { type: 'liens'; chemin: string; libelle: CleI18n }
  | { type: 'lignes'; chemin: string; libelle: CleI18n }
  | {
      type: 'cases';
      chemin: string;
      libelle: CleI18n;
      choix: { valeur: string; libelle: CleI18n }[];
    };

export interface GroupeChamps {
  titre: CleI18n;
  champs: Descripteur[];
}

export const GROUPES: GroupeChamps[] = [
  {
    titre: 'admin.site.groupe_identite',
    champs: [
      { type: 'texte', chemin: 'nom', libelle: 'admin.site.nom' },
      { type: 'texte', chemin: 'slogan', libelle: 'admin.site.slogan' },
      { type: 'texte', chemin: 'description', libelle: 'admin.site.description', long: true },
      { type: 'liens', chemin: 'liens', libelle: 'admin.site.liens' },
    ],
  },
  {
    titre: 'admin.site.groupe_options',
    champs: [
      { type: 'case', chemin: 'options.telechargements', libelle: 'admin.site.telechargements' },
      { type: 'case', chemin: 'options.aleatoire', libelle: 'admin.site.aleatoire' },
    ],
  },
  {
    titre: 'admin.site.groupe_accueil',
    champs: [
      { type: 'lignes', chemin: 'accueil.misesEnAvant', libelle: 'admin.site.mises_en_avant' },
    ],
  },
  {
    titre: 'admin.site.groupe_fond',
    champs: [
      { type: 'case', chemin: 'fond.actif', libelle: 'admin.site.fond_actif' },
      {
        type: 'curseur',
        chemin: 'fond.intensite',
        libelle: 'admin.site.fond_intensite',
        min: LIMITES_FOND.intensiteMin,
        max: LIMITES_FOND.intensiteMax,
        pas: 0.05,
      },
      {
        type: 'curseur',
        chemin: 'fond.vitesse',
        libelle: 'admin.site.fond_vitesse',
        min: LIMITES_FOND.vitesseMin,
        max: LIMITES_FOND.vitesseMax,
        pas: 0.25,
      },
      { type: 'case', chemin: 'fond.visualiseur', libelle: 'admin.site.fond_visualiseur' },
    ],
  },
  {
    titre: 'admin.site.groupe_menu',
    champs: [
      {
        type: 'cases',
        chemin: 'menu.masques',
        libelle: 'admin.site.menu_masquer',
        choix: ENTREES_MENU.map((valeur) => ({
          valeur,
          libelle: `nav.${valeur}` as CleI18n,
        })),
      },
    ],
  },
];

/** Tous les descripteurs, à plat. */
export const DESCRIPTEURS: Descripteur[] = GROUPES.flatMap((g) => g.champs);

/** Valeur située à `chemin` (« fond.actif ») dans un objet. */
export function lireChemin(objet: unknown, chemin: string): unknown {
  let courant = objet;
  for (const cle of chemin.split('.')) {
    if (typeof courant !== 'object' || courant === null) return undefined;
    courant = (courant as Record<string, unknown>)[cle];
  }
  return courant;
}

/** Copie de `objet` où la valeur située à `chemin` est remplacée ; l'original n'est pas modifié. */
export function ecrireChemin<T extends object>(objet: T, chemin: string, valeur: unknown): T {
  const [cle, ...reste] = chemin.split('.');
  if (cle === undefined) return objet;
  const source = objet as Record<string, unknown>;
  const suite =
    reste.length === 0
      ? valeur
      : ecrireChemin((source[cle] ?? {}) as Record<string, unknown>, reste.join('.'), valeur);
  return { ...source, [cle]: suite } as T;
}

export interface ProblemeReglage {
  /** Chemin du champ (« liens.0.url »), ou vide pour le fichier entier. */
  chemin: string;
  message: string;
}

export type ResultatValidation =
  { ok: true; reglages: Reglages } | { ok: false; problemes: ProblemeReglage[] };

/** Validation stricte des réglages, comme au build. */
export function validerReglages(brut: unknown): ResultatValidation {
  const resultat = ReglagesSchema.safeParse(brut);
  if (resultat.success) return { ok: true, reglages: resultat.data };
  return {
    ok: false,
    problemes: resultat.error.issues.map((i) => ({
      chemin: i.path.join('.'),
      message: i.message,
    })),
  };
}

/** Texte du fichier `site.json` : deux espaces d'indentation et un retour à la ligne final. */
export function serialiserReglages(reglages: Reglages): string {
  return `${JSON.stringify(reglages, null, 2)}\n`;
}

/** Réglages du dépôt, complétés par les valeurs par défaut pour les champs manquants. */
export function reglagesDepuisFichier(brut: unknown): Reglages {
  const defaut = reglagesParDefaut();
  if (typeof brut !== 'object' || brut === null) return defaut;
  const fusion = (
    a: Record<string, unknown>,
    b: Record<string, unknown>,
  ): Record<string, unknown> => {
    const sortie: Record<string, unknown> = { ...a };
    for (const [cle, valeur] of Object.entries(b)) {
      const base = sortie[cle];
      sortie[cle] =
        typeof valeur === 'object' &&
        valeur !== null &&
        !Array.isArray(valeur) &&
        typeof base === 'object' &&
        base !== null &&
        !Array.isArray(base)
          ? fusion(base as Record<string, unknown>, valeur as Record<string, unknown>)
          : valeur;
    }
    return sortie;
  };
  return fusion(
    defaut as unknown as Record<string, unknown>,
    brut as Record<string, unknown>,
  ) as unknown as Reglages;
}

/** Identifiants de pistes et d'albums connus du dépôt (pour signaler une mise en avant inconnue). */
export function identifiantsConnus(depot: AnalyseDepot): Set<string> {
  return new Set([
    ...depot.pistes.map(identifiantPisteDepot),
    ...depot.albums.map(identifiantAlbumDepot),
  ]);
}
