// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { terminer } from './utilitaires.ts';

/**
 * Usage : verifier-docs.ts [--staged | --base <ref>]
 * - sans argument ou --staged : compare l'index au dernier commit
 * - --base <ref> : compare HEAD à la référence (CI)
 * Contournement d'un commit purement documentaire : AP3X_COMMIT_DOC=1
 */
const args = process.argv.slice(2);
const baseIndex = args.indexOf('--base');
const gitArgs =
  baseIndex >= 0
    ? ['diff', '--name-only', `${args[baseIndex + 1] ?? 'HEAD~1'}...HEAD`]
    : ['diff', '--name-only', '--cached'];
const modifies = execFileSync('git', gitArgs, { encoding: 'utf8' })
  .split('\n')
  .filter((ligne) => ligne !== '');

const erreurs: string[] = [];
const CONFIGURATION =
  /^(package\.json|tsconfig\.json|vite\.config\.ts|eslint\.config\.js|index\.html)$/;
const sensible = modifies.some(
  (f) =>
    /^(src|scripts|public)\//.test(f) ||
    CONFIGURATION.test(f) ||
    f.startsWith('.github/') ||
    f.startsWith('.husky/'),
);

if (sensible && !modifies.includes('CHANGELOG.md') && process.env['AP3X_COMMIT_DOC'] !== '1') {
  erreurs.push('Des fichiers du projet changent sans modification de CHANGELOG.md.');
}

if (existsSync('README.md') && existsSync('package.json')) {
  const readme = readFileSync('README.md', 'utf8');
  const { scripts } = JSON.parse(readFileSync('package.json', 'utf8')) as {
    scripts: Record<string, string>;
  };
  for (const [, nom] of readme.matchAll(/npm run ([\w:-]+)/g)) {
    if (nom !== undefined && !(nom in scripts)) {
      erreurs.push(`README.md référence une commande inexistante : npm run ${nom}`);
    }
  }
  for (const [, chemin] of readme.matchAll(/`((?:src|scripts|public)\/[^`\s]*)`/g)) {
    if (chemin !== undefined && !existsSync(chemin.replace(/\/$/, ''))) {
      erreurs.push(`README.md référence un chemin inexistant : ${chemin}`);
    }
  }
}
terminer(erreurs, 'Docs : documentation cohérente.');
