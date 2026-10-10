// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import en from './en.json';
import { reglages } from '../site/reglages';
import { remplacerVariables } from './variables';

export type CleI18n = keyof typeof en;
export type Dictionnaire = Record<CleI18n, string>;

export const LANGUES = ['en', 'fr', 'de', 'ja', 'es', 'ru', 'vi', 'zh', 'ko'] as const;
export type Langue = (typeof LANGUES)[number];

const CLE_STOCKAGE = 'ap3x.langue';

/**
 * Les dictionnaires autres que l'anglais (référence, toujours embarqué) sont des morceaux séparés,
 * chargés à la demande : un visiteur n'en télécharge qu'un.
 */
const chargeurs = import.meta.glob<Dictionnaire>(['./*.json', '!./en.json'], { import: 'default' });
const dictionnaires = new Map<Langue, Dictionnaire>([['en', en]]);

/** Charge le dictionnaire d'une langue (sans effet s'il l'est déjà). À appeler avant `t()` pour cette langue. */
export async function chargerLangue(langue: Langue): Promise<void> {
  if (dictionnaires.has(langue)) return;
  const charger = chargeurs[`./${langue}.json`];
  if (charger !== undefined) dictionnaires.set(langue, await charger());
}

function dictionnaireDe(langue: Langue): Dictionnaire {
  return dictionnaires.get(langue) ?? en;
}

function estLangue(valeur: string | null | undefined): valeur is Langue {
  return valeur !== null && valeur !== undefined && (LANGUES as readonly string[]).includes(valeur);
}

function langueMemorisee(): Langue | null {
  try {
    const valeur = localStorage.getItem(CLE_STOCKAGE);
    return estLangue(valeur) ? valeur : null;
  } catch {
    return null;
  }
}

function langueDuNavigateur(): Langue {
  for (const candidate of navigator.languages) {
    const base = candidate.toLowerCase().split('-')[0];
    if (estLangue(base)) {
      return base;
    }
  }
  return 'en';
}

let langueCourante: Langue = langueMemorisee() ?? langueDuNavigateur();

export function obtenirLangue(): Langue {
  return langueCourante;
}

/** Change de langue : charge le dictionnaire, puis met à jour l'interface (événement `changement-langue`). */
export async function definirLangue(langue: Langue): Promise<void> {
  await chargerLangue(langue);
  langueCourante = langue;
  document.documentElement.lang = langue;
  try {
    localStorage.setItem(CLE_STOCKAGE, langue);
  } catch {
    // Stockage indisponible : le choix n'est pas mémorisé.
  }
  window.dispatchEvent(new CustomEvent('changement-langue', { detail: langue }));
}

/** Traduit une clé ; repli sur l'anglais si la clé manque dans la langue courante. */
export function t(cle: CleI18n): string {
  // Le nom du site est un réglage (public/site.json), le même dans toutes les langues.
  if (cle === 'site.nom') return reglages.nom;
  return dictionnaireDe(langueCourante)[cle] ?? en[cle];
}

/** Traduit une clé contenant des variables `{nom}` et les remplace. */
export function tv(cle: CleI18n, variables: Record<string, string | number>): string {
  return remplacerVariables(t(cle), variables);
}

document.documentElement.lang = langueCourante;
