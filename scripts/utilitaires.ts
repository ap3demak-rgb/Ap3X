// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { execFileSync } from 'node:child_process';

/** Fichiers suivis par git ou prêts à l'être (hors fichiers ignorés). */
export function fichiersDuDepot(): string[] {
  const sortie = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard'], {
    encoding: 'utf8',
  });
  return [...new Set(sortie.split('\n').filter((ligne) => ligne !== ''))];
}

export function terminer(erreurs: string[], messageSucces: string): never {
  if (erreurs.length > 0) {
    console.error(erreurs.join('\n'));
    console.error(`\n${erreurs.length} problème(s) détecté(s).`);
    process.exit(1);
  }
  console.log(messageSucces);
  process.exit(0);
}
