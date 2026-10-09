// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readdir, rm } from 'node:fs/promises';
import { extname, join } from 'node:path';

/**
 * Après `vite build` : retire de `dist/musique/` les images d'origine (pochettes souvent très lourdes).
 * Le catalogue ne référence plus que leurs déclinaisons WebP et JPEG redimensionnées (`dist/pochettes/`).
 * Usage : tsx scripts/nettoyer-dist.ts [dossier-dist]
 */
const dist = process.argv[2] ?? 'dist';
const IMAGES = new Set(['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.tif', '.tiff']);

async function retirerImages(dossier: string): Promise<number> {
  let retirees = 0;
  let entrees;
  try {
    entrees = await readdir(dossier, { withFileTypes: true });
  } catch {
    return 0;
  }
  for (const entree of entrees) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      retirees += await retirerImages(chemin);
    } else if (IMAGES.has(extname(entree.name).toLowerCase())) {
      await rm(chemin);
      retirees += 1;
    }
  }
  return retirees;
}

const retirees = await retirerImages(join(dist, 'musique'));
console.log(`Nettoyage de ${dist}/musique : ${retirees} image(s) d'origine retirée(s).`);
