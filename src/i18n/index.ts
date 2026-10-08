// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import en from './en.json';
import { remplacerVariables } from './variables';

export type CleI18n = keyof typeof en;
export type Dictionnaire = Record<CleI18n, string>;

export const LANGUES = ['en', 'fr', 'de', 'ja', 'es', 'ru', 'vi', 'zh', 'ko'] as const;
export type Langue = (typeof LANGUES)[number];

const CLE_STOCKAGE = 'ap3x.langue';

const modules = import.meta.glob<Dictionnaire>('./*.json', { eager: true, import: 'default' });

function dictionnaireDe(langue: Langue): Dictionnaire {
  return modules[`./${langue}.json`] ?? en;
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

export function definirLangue(langue: Langue): void {
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
  return dictionnaireDe(langueCourante)[cle] ?? en[cle];
}

/** Traduit une clé contenant des variables `{nom}` et les remplace. */
export function tv(cle: CleI18n, variables: Record<string, string | number>): string {
  return remplacerVariables(t(cle), variables);
}

document.documentElement.lang = langueCourante;
