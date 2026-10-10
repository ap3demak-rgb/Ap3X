// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { lireSite } from './site.ts';

/**
 * Après `vite build` : applique les réglages du site (`public/site.json`) au manifeste de l'application
 * installable (nom, nom court, description). Usage : tsx scripts/appliquer-reglages.ts [dossier-dist]
 */
const dist = process.argv[2] ?? 'dist';
const site = lireSite();
const chemin = join(dist, 'manifest.webmanifest');
const manifeste = JSON.parse(await readFile(chemin, 'utf8')) as Record<string, unknown>;

// Le nom court s'affiche sous l'icône : on garde le premier mot, 12 caractères au plus.
const nomCourt = (site.nom.split(/\s+/)[0] ?? site.nom).slice(0, 12);
manifeste['name'] = site.nom;
manifeste['short_name'] = nomCourt;
manifeste['description'] = site.description;
await writeFile(chemin, `${JSON.stringify(manifeste, null, 2)}\n`);
console.log(`Réglages appliqués au manifeste : « ${site.nom} » (${nomCourt}).`);
