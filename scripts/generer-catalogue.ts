// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { construireCatalogue } from './catalogue/construire.ts';

/**
 * Parcourt public/musique/ et écrit public/catalogue.json.
 * Usage : tsx scripts/generer-catalogue.ts [dossier-musique] [fichier-sortie] [dossier-pochettes]
 */
const racine = process.argv[2] ?? join('public', 'musique');
const sortie = process.argv[3] ?? join('public', 'catalogue.json');
const dossierPochettes = process.argv[4] ?? join('public', 'pochettes');

const { catalogue, erreurs, avertissements, nettoyerPochettes } = await construireCatalogue({
  racine,
  dossierPochettes,
});

for (const avertissement of avertissements) console.warn(`Avertissement : ${avertissement}`);
if (erreurs.length > 0) {
  for (const erreur of erreurs) console.error(`Erreur : ${erreur}`);
  console.error(`\nCatalogue non généré : ${erreurs.length} erreur(s).`);
  process.exit(1);
}

const supprimees = await nettoyerPochettes();
await mkdir(dirname(sortie), { recursive: true });
await writeFile(sortie, JSON.stringify(catalogue));
console.log(
  `Catalogue généré : ${catalogue.categories.length} catégorie(s), ${catalogue.albums.length} album(s), ` +
    `${catalogue.pistes.length} piste(s), ${catalogue.hashtags.length} hashtag(s)` +
    (supprimees > 0 ? ` (${supprimees} ancienne(s) pochette(s) supprimée(s)).` : '.'),
);
