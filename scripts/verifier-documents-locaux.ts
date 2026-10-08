// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { execFileSync } from 'node:child_process';
import { existsSync, statSync } from 'node:fs';
import { terminer } from './utilitaires.ts';

/**
 * Refuse le commit si des sources sont indexées alors que ROADMAP.md, MEMOIRE.md et CLAUDE.md
 * n'ont pas été modifiés depuis le dernier commit (ces fichiers sont hors dépôt).
 * Contournement d'un commit purement documentaire : AP3X_COMMIT_DOC=1
 */
const indexes = execFileSync('git', ['diff', '--name-only', '--cached'], { encoding: 'utf8' })
  .split('\n')
  .filter((ligne) => ligne !== '');
const sources = indexes.some((f) => !f.endsWith('.md'));

let dernierCommit = 0;
try {
  dernierCommit =
    Number(execFileSync('git', ['log', '-1', '--format=%ct'], { encoding: 'utf8' }).trim()) * 1000;
} catch {
  // Premier commit : aucun commit précédent.
}

const erreurs: string[] = [];
if (sources && process.env['AP3X_COMMIT_DOC'] !== '1') {
  for (const doc of ['ROADMAP.md', 'MEMOIRE.md', 'CLAUDE.md']) {
    if (!existsSync(doc)) {
      erreurs.push(`${doc} est absent.`);
    } else if (statSync(doc).mtimeMs <= dernierCommit) {
      erreurs.push(`${doc} n'a pas été mis à jour depuis le dernier commit.`);
    }
  }
}
terminer(erreurs, 'Documents locaux à jour.');
