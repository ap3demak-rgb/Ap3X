// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import { MPEGDecoder } from 'mpg123-decoder';

/** Nombre de barres de la waveform stockées pour chaque piste. */
export const NOMBRE_PICS = 200;
const FICHIER_CACHE = '.cache/pics.json';
const VERSION_CACHE = 1;

/**
 * Réduit les canaux PCM en `nombre` pics d'amplitude, entiers de 0 à 100, normalisés sur le pic le
 * plus élevé de la piste (une piste très douce garde ainsi une forme lisible).
 */
export function picsDepuisCanaux(canaux: Float32Array[], nombre: number = NOMBRE_PICS): number[] {
  const longueur = canaux[0]?.length ?? 0;
  if (longueur === 0 || nombre <= 0) return [];
  const maxima = new Array<number>(nombre).fill(0);
  for (let i = 0; i < nombre; i += 1) {
    const debut = Math.floor((i * longueur) / nombre);
    const fin = Math.max(debut + 1, Math.floor(((i + 1) * longueur) / nombre));
    let maximum = 0;
    for (const canal of canaux) {
      for (let j = debut; j < fin && j < canal.length; j += 1) {
        const valeur = Math.abs(canal[j] ?? 0);
        if (valeur > maximum) maximum = valeur;
      }
    }
    maxima[i] = maximum;
  }
  const plafond = Math.max(...maxima);
  if (plafond === 0) return maxima.map(() => 0);
  return maxima.map((valeur) => Math.round((valeur / plafond) * 100));
}

interface Cache {
  version: number;
  pics: Record<string, number[]>;
}

/** Calcule (ou relit dans le cache, indexé par l'empreinte du fichier) les pics d'un MP3. */
export class CalculateurPics {
  private cache: Cache = { version: VERSION_CACHE, pics: {} };
  private charge = false;
  private modifie = false;

  private async chargerCache(): Promise<void> {
    if (this.charge) return;
    this.charge = true;
    if (!existsSync(FICHIER_CACHE)) return;
    try {
      const lu = JSON.parse(await readFile(FICHIER_CACHE, 'utf8')) as Cache;
      if (lu.version === VERSION_CACHE) this.cache = lu;
    } catch {
      // Cache illisible : il est recalculé.
    }
  }

  async pour(chemin: string, nombre: number = NOMBRE_PICS): Promise<number[]> {
    await this.chargerCache();
    const octets = await readFile(chemin);
    const cle = `${createHash('sha1').update(octets).digest('hex')}:${nombre}`;
    const connu = this.cache.pics[cle];
    if (connu !== undefined) return connu;

    const decodeur = new MPEGDecoder();
    try {
      await decodeur.ready;
      const { channelData } = decodeur.decode(new Uint8Array(octets));
      const pics = picsDepuisCanaux(channelData, nombre);
      this.cache.pics[cle] = pics;
      this.modifie = true;
      return pics;
    } finally {
      decodeur.free();
    }
  }

  async enregistrer(): Promise<void> {
    if (!this.modifie) return;
    await mkdir(dirname(FICHIER_CACHE), { recursive: true });
    await writeFile(FICHIER_CACHE, JSON.stringify(this.cache));
  }
}
