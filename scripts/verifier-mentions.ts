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
const PLACEHOLDERS = [
  ['TO', 'DO'],
  ['FIX', 'ME'],
  ['lorem ', 'ipsum'],
].map((morceaux) => morceaux.join(''));

// Le nom du fichier de consignes local reste autorisé (il est déclaré dans .gitignore).
const NOM_AUTORISE = ['cla', 'ude.md'].join('');

const IGNORES = new Set(['package-lock.json', 'LICENSE', 'COPYING']);
const BINAIRES = /\.(ico|png|mp3|webp|jpg|jpeg)$/;
const erreurs: string[] = [];

for (const fichier of fichiersDuDepot()) {
  if (IGNORES.has(fichier) || BINAIRES.test(fichier)) continue;
  if (!existsSync(fichier) || statSync(fichier).size > 2_000_000) continue;
  const contenu = readFileSync(fichier, 'utf8').toLowerCase().replaceAll(NOM_AUTORISE, '');
  for (const motif of INTERDITES) {
    if (contenu.includes(motif)) erreurs.push(`Mention interdite dans ${fichier}`);
  }
  for (const motif of PLACEHOLDERS) {
    if (contenu.includes(motif.toLowerCase())) {
      erreurs.push(`Placeholder « ${motif} » dans ${fichier}`);
    }
  }
}
terminer(erreurs, 'Mentions : aucune mention interdite ni placeholder.');
