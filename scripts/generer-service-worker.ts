// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { createHash } from 'node:crypto';
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join, relative, sep } from 'node:path';
import { build } from 'esbuild';
import { BASE_SITE } from '../src/constantes.ts';
import { PREFIXE_CACHE, listePrechargement } from '../src/sw/strategies.ts';

/**
 * Après `vite build` (et le nettoyage de `dist/`) : compile `src/sw/sw.ts` en `dist/sw.js`, avec la
 * liste des fichiers de la coquille de l'application à précharger et une version dérivée de leur contenu.
 * Usage : tsx scripts/generer-service-worker.ts [dossier-dist]
 */
const dist = process.argv[2] ?? 'dist';

async function fichiers(dossier: string): Promise<string[]> {
  const resultat: string[] = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) resultat.push(...(await fichiers(chemin)));
    else resultat.push(relative(dist, chemin).split(sep).join('/'));
  }
  return resultat;
}

const prechargement = listePrechargement(await fichiers(dist), BASE_SITE);
const empreinte = createHash('sha1');
for (const chemin of prechargement) {
  const relatif = chemin === BASE_SITE ? 'index.html' : chemin.slice(BASE_SITE.length);
  empreinte.update(relatif).update(await readFile(join(dist, relatif)));
}
// L'horodatage ordonne les caches entre eux ; l'empreinte garantit qu'un contenu différent change de version.
const version = `${Date.now()}-${empreinte.digest('hex').slice(0, 10)}`;

const resultat = await build({
  entryPoints: ['src/sw/sw.ts'],
  bundle: true,
  minify: true,
  format: 'iife',
  target: 'es2022',
  write: false,
  define: {
    __VERSION__: JSON.stringify(version),
    __BASE__: JSON.stringify(BASE_SITE),
    __PRECHARGEMENT__: JSON.stringify(prechargement),
  },
  banner: { js: '// SPDX-License-Identifier: GPL-3.0-or-later\n// © 2026 AP3X Records' },
  logLevel: 'warning',
});
const sortie = resultat.outputFiles[0];
if (sortie === undefined) throw new Error("esbuild n'a produit aucun fichier");
await writeFile(join(dist, 'sw.js'), sortie.text);
console.log(
  `Service worker : ${prechargement.length} fichier(s) préchargé(s), cache ${PREFIXE_CACHE}${version}.`,
);
