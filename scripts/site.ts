// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { ID_BALISE_REGLAGES, type Reglages } from '../src/site/reglages.ts';
import { ReglagesSchema } from '../src/site/schema.ts';

/** Fichier des réglages du site, modifiable depuis la page d'administration. */
export const FICHIER_REGLAGES = join('public', 'site.json');

/**
 * Lit et valide `public/site.json`. Une erreur (JSON invalide, champ inconnu, valeur hors limites) arrête
 * le build avec la liste des problèmes : un réglage cassé ne doit jamais être publié.
 */
export function lireSite(racine = '.'): Reglages {
  const chemin = join(racine, FICHIER_REGLAGES);
  let brut: unknown;
  try {
    brut = JSON.parse(readFileSync(chemin, 'utf8'));
  } catch (erreur) {
    throw new Error(`${chemin} : fichier absent ou JSON invalide (${(erreur as Error).message})`, {
      cause: erreur,
    });
  }
  const resultat = ReglagesSchema.safeParse(brut);
  if (!resultat.success) {
    const problemes = resultat.error.issues
      .map((i) => `  - ${i.path.join('.') || '(racine)'} : ${i.message}`)
      .join('\n');
    throw new Error(`${chemin} : réglages invalides\n${problemes}`);
  }
  return resultat.data;
}

/** Balise insérée dans index.html : le JSON est échappé pour ne jamais pouvoir fermer la balise. */
export function baliseReglages(reglages: Reglages): string {
  const json = JSON.stringify(reglages).replaceAll('<', '\\u003c');
  return `<script type="application/json" id="${ID_BALISE_REGLAGES}">${json}</script>`;
}

/** Échappe un texte pour un attribut ou un contenu HTML. */
export function echapperHtml(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
}
