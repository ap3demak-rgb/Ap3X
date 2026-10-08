// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync, readFileSync, statSync } from 'node:fs';
import { fichiersDuDepot, terminer } from './utilitaires.ts';

// Les motifs sont assemblés à partir de fragments pour que ce fichier ne se détecte pas lui-même.
const INTERDITES = [
  ['cla', 'ude'],
  ['anth', 'ropic'],
  ['chat', 'gpt'],
  ['co-auth', 'ored-by'],
  ['assistant ', 'virtuel'],
  ['intelligence ', 'artificielle'],
].map((morceaux) => morceaux.join(''));
// Marqueurs en majuscules uniquement (« todo » est un mot espagnol courant), mots entiers.
const PLACEHOLDERS = [
  new RegExp(['\\bTO', 'DO\\b'].join('')),
  new RegExp(['\\bFIX', 'ME\\b'].join('')),
  new RegExp(['lorem ', 'ipsum'].join(''), 'i'),
];

// Le nom du fichier de consignes local reste autorisé (il est déclaré dans .gitignore).
const NOM_AUTORISE = ['cla', 'ude.md'].join('');

const IGNORES = new Set(['package-lock.json', 'LICENSE', 'COPYING']);
const BINAIRES = /\.(ico|png|mp3|webp|jpg|jpeg)$/;
const erreurs: string[] = [];

for (const fichier of fichiersDuDepot()) {
  if (IGNORES.has(fichier) || BINAIRES.test(fichier)) continue;
  if (!existsSync(fichier) || statSync(fichier).size > 2_000_000) continue;
  const brut = readFileSync(fichier, 'utf8').replaceAll(new RegExp(NOM_AUTORISE, 'gi'), '');
  const contenu = brut.toLowerCase();
  for (const motif of INTERDITES) {
    if (contenu.includes(motif)) erreurs.push(`Mention interdite dans ${fichier}`);
  }
  for (const motif of PLACEHOLDERS) {
    if (motif.test(brut)) {
      erreurs.push(`Placeholder (${motif.source}) dans ${fichier}`);
    }
  }
}
terminer(erreurs, 'Mentions : aucune mention interdite ni placeholder.');
