// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { terminer } from './utilitaires.ts';

// Motifs assemblés à partir de fragments pour que ce fichier ne se détecte pas lui-même.
const INTERDITES = [
  ['cla', 'ude'],
  ['anth', 'ropic'],
  ['chat', 'gpt'],
  ['co-auth', 'ored-by'],
  ['generated ', 'with'],
  ['assis', 'tant'],
  ['\\bI', 'A\\b'],
  ['\\bA', 'I\\b'],
].map((morceaux) => new RegExp(morceaux.join(''), 'i'));

const fichier = process.argv[2];
if (fichier === undefined) {
  terminer(['Usage : verifier-message-commit.ts <fichier-message>'], '');
} else {
  const message = readFileSync(fichier, 'utf8');
  const erreurs = INTERDITES.filter((motif) => motif.test(message)).map(
    (motif) => `Message de commit refusé : mention interdite (${motif.source}).`,
  );
  terminer(erreurs, 'Message de commit valide.');
}
