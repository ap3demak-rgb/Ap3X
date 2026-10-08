// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { terminer } from './utilitaires.ts';

const LANGUES = ['fr', 'de', 'ja', 'es', 'ru', 'vi', 'zh', 'ko'];

function cles(langue: string): string[] {
  const contenu = JSON.parse(readFileSync(`src/i18n/${langue}.json`, 'utf8')) as Record<
    string,
    unknown
  >;
  for (const [cle, valeur] of Object.entries(contenu)) {
    if (typeof valeur !== 'string' || valeur.trim() === '') {
      throw new Error(`${langue}.json : valeur vide ou invalide pour « ${cle} »`);
    }
  }
  return Object.keys(contenu);
}

const reference = new Set(cles('en'));
const erreurs: string[] = [];
for (const langue of LANGUES) {
  const courantes = new Set(cles(langue));
  for (const cle of reference) {
    if (!courantes.has(cle)) erreurs.push(`${langue}.json : clé manquante « ${cle} »`);
  }
  for (const cle of courantes) {
    if (!reference.has(cle)) erreurs.push(`${langue}.json : clé en trop « ${cle} »`);
  }
}
terminer(erreurs, `i18n : les ${LANGUES.length} langues sont complètes par rapport à en.json.`);
