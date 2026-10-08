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
terminer(erreurs, 'Licences : tous les en-têtes SPDX sont présents.');
