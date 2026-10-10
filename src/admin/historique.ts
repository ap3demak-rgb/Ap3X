// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Changement, DetailCommit } from './github';

export type ErreurAnnulation =
  | { code: 'fusion' }
  | { code: 'trop' }
  | { code: 'conflit'; chemins: string[] }
  | { code: 'introuvable'; chemins: string[] };

export type PlanAnnulation =
  | { ok: true; changements: Changement[]; message: string }
  | { ok: false; erreur: ErreurAnnulation };

/** Première ligne d'un message de commit. */
export function titreDeCommit(message: string): string {
  return message.split('\n', 1)[0]?.trim() ?? '';
}

/**
 * Chemins dont il faut connaître l'empreinte avant le commit pour pouvoir l'annuler : tous ceux qu'il a
 * modifiés, supprimés ou renommés (un fichier ajouté, lui, sera simplement supprimé).
 */
export function cheminsADeterminer(detail: DetailCommit): string[] {
  const chemins = new Set<string>();
  for (const f of detail.fichiers) {
    if (f.statut === 'added') continue;
    chemins.add(f.statut === 'renamed' ? (f.ancienChemin ?? f.chemin) : f.chemin);
  }
  return [...chemins];
}

/**
 * Plan d'annulation d'un commit : un nouveau commit qui remet chaque fichier dans l'état qu'il avait avant
 * (contenu repris par son empreinte, rien n'est renvoyé). L'annulation est refusée si l'un des fichiers a
 * encore changé depuis, pour ne jamais écraser un travail plus récent.
 *
 * @param actuel empreintes des fichiers de la branche aujourd'hui
 * @param avant empreintes des fichiers avant le commit (`undefined` : le fichier n'existait pas)
 */
export function planAnnulation(
  detail: DetailCommit,
  actuel: ReadonlyMap<string, string>,
  avant: ReadonlyMap<string, string | undefined>,
): PlanAnnulation {
  if (detail.parents.length !== 1) return { ok: false, erreur: { code: 'fusion' } };
  if (detail.tronque) return { ok: false, erreur: { code: 'trop' } };

  const conflits: string[] = [];
  const introuvables: string[] = [];
  const changements: Changement[] = [];
  const restaurer = (chemin: string, sha: string | undefined): void => {
    if (sha === undefined) introuvables.push(chemin);
    else changements.push({ chemin, sha });
  };

  for (const f of detail.fichiers) {
    switch (f.statut) {
      case 'added':
      case 'copied':
        if (actuel.get(f.chemin) !== f.sha) conflits.push(f.chemin);
        else changements.push({ chemin: f.chemin, supprimer: true });
        break;
      case 'removed':
        if (actuel.has(f.chemin)) conflits.push(f.chemin);
        else restaurer(f.chemin, avant.get(f.chemin));
        break;
      case 'renamed': {
        const ancien = f.ancienChemin ?? f.chemin;
        if (actuel.get(f.chemin) !== f.sha || actuel.has(ancien)) conflits.push(f.chemin);
        else {
          changements.push({ chemin: f.chemin, supprimer: true });
          restaurer(ancien, avant.get(ancien));
        }
        break;
      }
      case 'modified':
      case 'changed':
        if (actuel.get(f.chemin) !== f.sha) conflits.push(f.chemin);
        else restaurer(f.chemin, avant.get(f.chemin));
        break;
      default:
        break;
    }
  }
  if (conflits.length > 0)
    return { ok: false, erreur: { code: 'conflit', chemins: conflits.sort() } };
  if (introuvables.length > 0) {
    return { ok: false, erreur: { code: 'introuvable', chemins: introuvables.sort() } };
  }
  return {
    ok: true,
    changements,
    message: `annulation: ${titreDeCommit(detail.message)}`,
  };
}
