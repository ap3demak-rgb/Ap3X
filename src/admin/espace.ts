// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  analyserArbre,
  type AlbumDepot,
  type AnalyseDepot,
  type CategorieDepot,
  type PisteDepot,
} from './depot';
import { lireFicheBrute, type FicheBrute } from './edition';
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
 * (lu une fois, relu après chaque publication) et le texte des fiches déjà téléchargées (une fiche
 * est identifiée par son empreinte : une fiche modifiée a une nouvelle empreinte).
 */
export class Espace {
  private promesse: Promise<DepotAnalyse> | undefined;
  private readonly textes = new Map<string, string>();

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

  /** Texte d'un fichier d'après son empreinte (téléchargé une seule fois). */
  private async texteBlob(sha: string): Promise<string> {
    const connu = this.textes.get(sha);
    if (connu !== undefined) return connu;
    const contenu = new TextDecoder().decode(await this.client.lireBlob(sha));
    this.textes.set(sha, contenu);
    return contenu;
  }

  /** Texte de la fiche d'une piste, ou `undefined` si elle n'en a pas. */
  private async texteFiche(piste: PisteDepot): Promise<string | undefined> {
    return piste.fiche === undefined ? undefined : this.texteBlob(piste.fiche.sha);
  }

  /** `album.json` d'un album ; lève `ErreurFicheIllisible` s'il n'est pas lisible. */
  async ficheAlbum(album: AlbumDepot): Promise<FicheBrute> {
    return lireFicheBrute(await this.texteBlob(album.fiche.sha));
  }

  /** `categorie.json` d'une catégorie ; `undefined` si elle n'en a pas. */
  async ficheCategorie(categorie: CategorieDepot): Promise<FicheBrute | undefined> {
    return categorie.fiche === undefined
      ? undefined
      : lireFicheBrute(await this.texteBlob(categorie.fiche.sha));
  }

  /**
   * `categorie.json` de plusieurs catégories (clé : nom du dossier). Une fiche illisible lève une erreur :
   * la modifier ou réécrire l'ordre effacerait ses autres champs.
   */
  async fichesCategoriesDe(
    categories: readonly CategorieDepot[],
  ): Promise<Map<string, FicheBrute | undefined>> {
    const resultats = new Map<string, FicheBrute | undefined>();
    let echec: unknown;
    await this.enParallele(categories, async (categorie) => {
      try {
        resultats.set(categorie.dossier, await this.ficheCategorie(categorie));
      } catch (erreur) {
        echec ??= erreur;
      }
    });
    if (echec !== undefined) throw echec instanceof Error ? echec : new Error('Fiche illisible');
    return resultats;
  }

  /** `album.json` de plusieurs albums (clé : chemin du fichier) ; un fichier illisible donne `undefined`. */
  async fichesAlbumsDe(
    albums: readonly AlbumDepot[],
  ): Promise<Map<string, FicheBrute | undefined>> {
    const resultats = await this.enParallele(albums, (album) => this.ficheAlbum(album));
    return new Map(albums.map((album, i) => [album.fiche.chemin, resultats[i]]));
  }

  /** Résumé de la fiche d'une piste (liste d'administration). */
  async resume(piste: PisteDepot): Promise<ResumeFiche | undefined> {
    const texte = await this.texteFiche(piste);
    return texte === undefined ? undefined : lireResumeFiche(texte);
  }

  /** Fiche complète d'une piste, telle qu'écrite dans le dépôt ; lève une erreur si elle est illisible. */
  async ficheBrute(piste: PisteDepot): Promise<FicheBrute | undefined> {
    const texte = await this.texteFiche(piste);
    return texte === undefined ? undefined : lireFicheBrute(texte);
  }

  /** Exécute `tache` sur chaque élément, `PARALLELISME` à la fois ; une tâche qui échoue donne `undefined`. */
  private async enParallele<T, R>(
    elements: readonly T[],
    tache: (element: T) => Promise<R>,
    progression?: (recus: number) => void,
  ): Promise<(R | undefined)[]> {
    const resultats: (R | undefined)[] = new Array<R | undefined>(elements.length).fill(undefined);
    let suivant = 0;
    let recus = 0;
    const travailleur = async (): Promise<void> => {
      while (suivant < elements.length) {
        const index = suivant;
        suivant += 1;
        const courant = elements[index];
        if (courant === undefined) continue;
        try {
          resultats[index] = await tache(courant);
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

  /** Résumés de plusieurs pistes ; `progression` est appelé à chaque fiche reçue. */
  resumesDe(
    pistes: readonly PisteDepot[],
    progression?: (recus: number) => void,
  ): Promise<(ResumeFiche | undefined)[]> {
    return this.enParallele(pistes, (piste) => this.resume(piste), progression);
  }

  /**
   * Fiches complètes de plusieurs pistes, indexées par le chemin du MP3. Une fiche illisible lève une
   * erreur : modifier une piste dont la fiche est cassée effacerait ses autres champs.
   */
  async fichesDe(pistes: readonly PisteDepot[]): Promise<Map<string, FicheBrute | undefined>> {
    const resultats = new Map<string, FicheBrute | undefined>();
    let echec: unknown;
    await this.enParallele(pistes, async (piste) => {
      try {
        resultats.set(piste.mp3.chemin, await this.ficheBrute(piste));
      } catch (erreur) {
        echec ??= erreur;
      }
    });
    if (echec !== undefined) throw echec instanceof Error ? echec : new Error('Fiche illisible');
    return resultats;
  }
}
