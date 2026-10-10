// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { analyserArbre, type AnalyseDepot, type PisteDepot } from './depot';
import type { ClientGitHub } from './github';
import { lireResumeFiche, type ResumeFiche } from './liste';

export interface DepotAnalyse extends AnalyseDepot {
  /** La liste des fichiers de GitHub est incomplète (dépôt trop gros). */
  tronque: boolean;
}

/** Nombre maximal de fiches téléchargées en même temps. */
const PARALLELISME = 6;

/**
 * État partagé par les écrans d'administration d'une session : le client GitHub, le contenu du dépôt
 * (lu une fois, relu après chaque publication) et les fiches déjà téléchargées.
 */
export class Espace {
  private promesse: Promise<DepotAnalyse> | undefined;
  private readonly resumes = new Map<string, ResumeFiche>();

  constructor(readonly client: ClientGitHub) {}

  depot(): Promise<DepotAnalyse> {
    this.promesse ??= this.client
      .arbre()
      .then((arbre) => ({ ...analyserArbre(arbre.entrees), tronque: arbre.tronque }))
      .catch((erreur: unknown) => {
        this.promesse = undefined;
        throw erreur;
      });
    return this.promesse;
  }

  /** À appeler après une publication : le prochain `depot()` relira GitHub. */
  invalider(): void {
    this.promesse = undefined;
  }

  /** Résumé de la fiche d'une piste (le même sha n'est téléchargé qu'une fois). */
  async resume(piste: PisteDepot): Promise<ResumeFiche | undefined> {
    if (piste.fiche === undefined) return undefined;
    const connu = this.resumes.get(piste.fiche.sha);
    if (connu !== undefined) return connu;
    const contenu = await this.client.lireBlob(piste.fiche.sha);
    const resume = lireResumeFiche(new TextDecoder().decode(contenu));
    this.resumes.set(piste.fiche.sha, resume);
    return resume;
  }

  /**
   * Résumés de plusieurs pistes, téléchargés `PARALLELISME` à la fois. `progression` est appelé à chaque
   * fiche reçue ; une fiche qui échoue donne `undefined` sans interrompre les autres.
   */
  async resumesDe(
    pistes: readonly PisteDepot[],
    progression?: (recus: number) => void,
  ): Promise<(ResumeFiche | undefined)[]> {
    const resultats: (ResumeFiche | undefined)[] = new Array(pistes.length).fill(undefined);
    let suivant = 0;
    let recus = 0;
    const travailleur = async (): Promise<void> => {
      while (suivant < pistes.length) {
        const index = suivant;
        suivant += 1;
        const piste = pistes[index];
        if (piste === undefined) continue;
        try {
          resultats[index] = await this.resume(piste);
        } catch {
          resultats[index] = undefined;
        }
        recus += 1;
        progression?.(recus);
      }
    };
    await Promise.all(Array.from({ length: PARALLELISME }, travailleur));
    return resultats;
  }
}
