// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { BASE_SITE } from '../src/constantes.ts';

/**
 * Après `vite build` : intègre les feuilles de style référencées par `dist/index.html` directement dans
 * la page (balise `<style>`), puis supprime les fichiers CSS devenus inutiles. Le premier affichage ne
 * dépend plus d'une requête de plus (le CSS est la seule ressource qui bloque le rendu).
 * Usage : tsx scripts/integrer-css.ts [dossier-dist]
 */
const dist = process.argv[2] ?? 'dist';
const chemin = join(dist, 'index.html');
let html = await readFile(chemin, 'utf8');

const BALISE = /<link\s+rel="stylesheet"[^>]*?href="([^"]+\.css)"[^>]*>/g;
const trouvees = [...html.matchAll(BALISE)];
const retirees: string[] = [];
for (const [balise, href] of trouvees) {
  if (href === undefined) continue;
  const relatif = href.startsWith(BASE_SITE)
    ? href.slice(BASE_SITE.length)
    : href.replace(/^\/+/, '');
  const css = await readFile(join(dist, relatif), 'utf8');
  // Une fermeture de balise dans le CSS casserait la page : elle n'existe pas ici, mais on le vérifie.
  if (/<\/style/i.test(css))
    throw new Error(`${relatif} contient « </style » : intégration impossible`);
  html = html.replace(balise, () => `<style>${css.trim()}</style>`);
  retirees.push(relatif);
}
await writeFile(chemin, html);
for (const relatif of retirees) await rm(join(dist, relatif));
console.log(`CSS intégré à index.html : ${retirees.length} feuille(s) de style.`);
