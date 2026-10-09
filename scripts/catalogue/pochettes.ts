// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import sharp, { type Sharp } from 'sharp';
import {
  TAILLE_GRANDE,
  TAILLE_MINIATURE,
  TAILLE_PARTAGE,
  cheminImagePartage,
} from '../../src/catalogue/pochettes.ts';

export interface Pochette {
  /** Grande pochette WebP (pages de détail, texture 3D), chemin relatif à public/. */
  pochette: string;
  /** Miniature WebP (cartes, barre de lecture), chemin relatif à public/. */
  miniature: string;
}

const FOND_PARTAGE = '#0b0b10';

/**
 * Produit, pour chaque image source, une grande pochette WebP, une miniature WebP et un JPEG de
 * partage. Les fichiers portent l'empreinte du contenu : une image déjà convertie n'est pas refaite,
 * et deux fichiers identiques partagent leurs déclinaisons.
 */
export class ConvertisseurPochettes {
  private readonly utilises = new Set<string>();
  private readonly dejaTraitees = new Map<string, Pochette>();

  constructor(private readonly dossierSortie: string) {}

  async depuisFichier(chemin: string): Promise<Pochette> {
    return this.depuisDonnees(await readFile(chemin));
  }

  async depuisDonnees(donnees: Buffer | Uint8Array): Promise<Pochette> {
    const empreinte = createHash('sha1').update(donnees).digest('hex').slice(0, 16);
    const connue = this.dejaTraitees.get(empreinte);
    if (connue !== undefined) return connue;

    const grande = `${empreinte}.webp`;
    const miniature = `${empreinte}-m.webp`;
    const partage = cheminImagePartage(grande).replace(/^pochettes\//, '');
    for (const nom of [grande, miniature, partage]) this.utilises.add(nom);

    const sortie = (nom: string): string => join(this.dossierSortie, nom);
    if (![grande, miniature, partage].every((nom) => existsSync(sortie(nom)))) {
      await mkdir(this.dossierSortie, { recursive: true });
      const source = (): Sharp => sharp(donnees, { failOn: 'error' }).rotate();
      const redimensionner = (taille: number): Sharp =>
        source().resize(taille, taille, { fit: 'inside', withoutEnlargement: true });
      await redimensionner(TAILLE_GRANDE).webp({ quality: 82 }).toFile(sortie(grande));
      await redimensionner(TAILLE_MINIATURE).webp({ quality: 78 }).toFile(sortie(miniature));
      await redimensionner(TAILLE_PARTAGE)
        .flatten({ background: FOND_PARTAGE })
        .jpeg({ quality: 82, mozjpeg: true })
        .toFile(sortie(partage));
    }
    const resultat = { pochette: `pochettes/${grande}`, miniature: `pochettes/${miniature}` };
    this.dejaTraitees.set(empreinte, resultat);
    return resultat;
  }

  /** Supprime les fichiers du dossier de sortie qui ne correspondent à aucune pochette utilisée. */
  async nettoyer(): Promise<number> {
    if (!existsSync(this.dossierSortie)) return 0;
    let supprimes = 0;
    for (const nom of await readdir(this.dossierSortie)) {
      if (!this.utilises.has(nom)) {
        await rm(join(this.dossierSortie, nom), { recursive: true, force: true });
        supprimes += 1;
      }
    }
    return supprimes;
  }
}
