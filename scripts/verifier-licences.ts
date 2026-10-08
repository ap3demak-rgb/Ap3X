// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync, readFileSync } from 'node:fs';
import { extname } from 'node:path';
import { fichiersDuDepot, terminer } from './utilitaires.ts';

const EXTENSIONS = new Set([
  '.ts',
  '.css',
  '.html',
  '.mjs',
  '.js',
  '.svg',
  '.glsl',
  '.vert',
  '.frag',
  '.yml',
  '.yaml',
]);
const MARQUEUR = 'SPDX-License-Identifier: GPL-3.0-or-later';

const erreurs: string[] = [];
for (const fichier of fichiersDuDepot()) {
  if (!existsSync(fichier) || !EXTENSIONS.has(extname(fichier))) continue;
  const debut = readFileSync(fichier, 'utf8').split('\n').slice(0, 6).join('\n');
  if (!debut.includes(MARQUEUR)) {
    erreurs.push(`En-tête SPDX manquant : ${fichier}`);
  }
}
for (const requis of ['LICENSE', 'COPYING', 'REUSE.toml']) {
  if (!existsSync(requis)) erreurs.push(`Fichier requis absent : ${requis}`);
}
// Aucune liste de contributeurs autre qu'AP3X Records.
for (const interdit of ['AUTHORS', 'CONTRIBUTORS', 'AUTHORS.md', 'CONTRIBUTORS.md']) {
  if (existsSync(interdit)) erreurs.push(`Fichier de contributeurs interdit : ${interdit}`);
}
const paquet = JSON.parse(readFileSync('package.json', 'utf8')) as Record<string, unknown>;
if ('contributors' in paquet)
  erreurs.push('package.json ne doit pas contenir de champ contributors.');
if (paquet['author'] !== 'AP3X Records <ap3x.records@proton.me>') {
  erreurs.push('package.json : auteur attendu « AP3X Records <ap3x.records@proton.me> ».');
}
terminer(erreurs, 'Licences : tous les en-têtes SPDX sont présents.');
