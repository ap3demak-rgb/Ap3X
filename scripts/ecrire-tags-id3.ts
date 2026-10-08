// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readdir } from 'node:fs/promises';
import { join } from 'node:path';
import NodeID3 from 'node-id3';

/**
 * Écrit le copyright et l'URL officielle dans les tags ID3 de chaque MP3 de public/musique/.
 * Les autres tags existants (titre, artiste, pochette…) sont conservés.
 * Usage : tsx scripts/ecrire-tags-id3.ts [dossier]
 */
const ANNEE = 2026;
export const TAGS_DROITS: NodeID3.Tags = {
  copyright: `© ${ANNEE} AP3X Records – CC BY-NC-ND 4.0`,
  copyrightUrl: 'https://creativecommons.org/licenses/by-nc-nd/4.0/',
  artistUrl: ['https://github.com/ap3demak-rgb/Ap3X'],
  fileUrl: 'https://github.com/ap3demak-rgb/Ap3X',
};

async function fichiersMp3(dossier: string): Promise<string[]> {
  const resultat: string[] = [];
  for (const entree of await readdir(dossier, { withFileTypes: true })) {
    const chemin = join(dossier, entree.name);
    if (entree.isDirectory()) {
      resultat.push(...(await fichiersMp3(chemin)));
    } else if (entree.name.toLowerCase().endsWith('.mp3')) {
      resultat.push(chemin);
    }
  }
  return resultat;
}

if (process.argv[1]?.endsWith('ecrire-tags-id3.ts')) {
  const racine = process.argv[2] ?? join('public', 'musique');
  const fichiers = await fichiersMp3(racine);
  let echecs = 0;
  for (const fichier of fichiers) {
    const ok = NodeID3.update(TAGS_DROITS, fichier);
    if (ok !== true) {
      echecs += 1;
      console.error(`Échec d'écriture des tags : ${fichier}`);
    }
  }
  console.log(`${fichiers.length - echecs}/${fichiers.length} fichier(s) MP3 mis à jour.`);
  process.exit(echecs > 0 ? 1 : 0);
}
