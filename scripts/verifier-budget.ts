// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { extname, join, relative, sep } from 'node:path';
import { gzipSync } from 'node:zlib';
import { terminer } from './utilitaires.ts';

/**
 * Budget de performance, contrôlé sur le build (`dist/`). Les tailles sont compressées en gzip, comme
 * à la livraison. Usage : tsx scripts/verifier-budget.ts [dossier-dist]
 */
const BUDGET = {
  /** Script chargé au démarrage : l'interface s'affiche après lui. */
  scriptDeDemarrage: 90 * 1024,
  /** Chaque morceau chargé à la demande (Three.js, ZIP…). */
  morceauDiffere: 160 * 1024,
  /** Feuilles de style, toutes ensemble. */
  styles: 12 * 1024,
  /** Chaque pochette produite au build (déclinaison WebP ou JPEG). */
  pochette: 250 * 1024,
} as const;

const dist = process.argv[2] ?? 'dist';

/** Tous les fichiers d'un dossier, récursivement ; un dossier absent (aucune pochette, par exemple) est vide. */
function fichiers(dossier: string): string[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier, { withFileTypes: true }).flatMap((entree) =>
    entree.isDirectory() ? fichiers(join(dossier, entree.name)) : [join(dossier, entree.name)],
  );
}

const gzip = (chemin: string): number => gzipSync(readFileSync(chemin)).length;
const ko = (octets: number): string => `${(octets / 1024).toFixed(1)} Ko`;

const erreurs: string[] = [];
const html = readFileSync(join(dist, 'index.html'), 'utf8');
const demarrage = new Set(
  [...html.matchAll(/<script[^>]+src="[^"]*?(assets\/[^"]+\.js)"/g)].map((m) => m[1] ?? ''),
);
const lignes: string[] = [];

let styles = 0;
for (const chemin of fichiers(join(dist, 'assets'))) {
  const nom = relative(dist, chemin).split(sep).join('/');
  const taille = gzip(chemin);
  if (extname(chemin) === '.css') {
    styles += taille;
  } else if (extname(chemin) === '.js') {
    const demarre = demarrage.has(nom);
    const limite = demarre ? BUDGET.scriptDeDemarrage : BUDGET.morceauDiffere;
    lignes.push(`${demarre ? 'démarrage' : 'différé  '} ${nom} : ${ko(taille)} / ${ko(limite)}`);
    if (taille > limite) {
      erreurs.push(
        `${demarre ? 'Script de démarrage' : 'Morceau différé'} trop lourd : ${nom} = ${ko(taille)} (budget ${ko(limite)}).`,
      );
    }
  }
}
lignes.push(`styles    : ${ko(styles)} / ${ko(BUDGET.styles)}`);
if (styles > BUDGET.styles) {
  erreurs.push(`Styles trop lourds : ${ko(styles)} (budget ${ko(BUDGET.styles)}).`);
}
if (demarrage.size === 0) erreurs.push('Aucun script de démarrage trouvé dans index.html.');

const IMAGES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif']);
for (const chemin of fichiers(join(dist, 'pochettes'))) {
  const taille = statSync(chemin).size;
  if (taille > BUDGET.pochette) {
    erreurs.push(
      `Pochette trop lourde : ${relative(dist, chemin)} = ${ko(taille)} (budget ${ko(BUDGET.pochette)}).`,
    );
  }
}
// Les images d'origine ne doivent plus se trouver dans le dossier de musique publié.
for (const chemin of fichiers(join(dist, 'musique'))) {
  if (IMAGES.has(extname(chemin).toLowerCase())) {
    erreurs.push(`Image d'origine non retirée de dist : ${relative(dist, chemin)}.`);
  }
}

console.log(lignes.join('\n'));
terminer(erreurs, 'Budget de performance respecté.');
