// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { urlDuFichier } from './catalogue/charger';
import type { Donnees } from './catalogue/donnees';
import { pistesDeAlbum } from './catalogue/donnees';
import type { Album, Piste } from './catalogue/schemas';
import { URL_DEPOT } from './constantes';

export interface EntreeZip {
  nom: string;
  donnees: Uint8Array;
}

/** Nom de fichier sûr pour Windows, macOS et Linux : sans caractère interdit, sans point final. */
export function nomFichierSur(nom: string, longueurMax = 120): string {
  const nettoye = nom
    // eslint-disable-next-line no-control-regex
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '_')
    .replace(/[. ]+$/, '');
  const borne = [...nettoye].slice(0, longueurMax).join('').trim();
  return borne === '' ? '_' : borne;
}

/** Noms des fichiers audio d'un album : « 01 - Titre.mp3 », ou « 1-01 - Titre.mp3 » sur plusieurs disques. */
export function nomsDePistes(pistes: readonly Piste[]): string[] {
  const plusieursDisques = new Set(pistes.map((p) => p.disque ?? 1)).size > 1;
  const largeur = Math.max(2, String(pistes.length).length);
  const pris = new Set<string>();
  return pistes.map((piste, index) => {
    const numero = String(piste.numero ?? index + 1).padStart(largeur, '0');
    const prefixe = plusieursDisques ? `${piste.disque ?? 1}-${numero}` : numero;
    const base = nomFichierSur(`${prefixe} - ${piste.titre}`, 110);
    let nom = `${base}.mp3`;
    for (let n = 2; pris.has(nom.toLowerCase()); n += 1) nom = `${base} (${n}).mp3`;
    pris.add(nom.toLowerCase());
    return nom;
  });
}

/**
 * Texte joint à l'archive : l'attribution et la licence accompagnent chaque exemplaire téléchargé.
 * Rédigé en anglais, comme les tags ID3 : c'est une donnée de l'archive, pas un texte d'interface.
 */
export function texteLicence(album: Album): string {
  return [
    `${album.titre} – ${album.artiste}`,
    album.copyright,
    `License: ${album.licence}`,
    ...(album.reference !== undefined ? [`Catalogue reference: ${album.reference}`] : []),
    `Source: ${URL_DEPOT}`,
    '',
  ].join('\n');
}

/**
 * Assemble une archive ZIP sans compression (les MP3 le sont déjà). La bibliothèque est chargée à la
 * demande pour ne pas alourdir le site.
 */
export async function construireZip(entrees: readonly EntreeZip[]): Promise<Blob> {
  const { Zip, ZipPassThrough } = await import('fflate');
  return new Promise<Blob>((resoudre, rejeter) => {
    const morceaux: Uint8Array[] = [];
    const zip = new Zip((erreur, donnees, fin) => {
      if (erreur !== null) {
        rejeter(erreur);
        return;
      }
      morceaux.push(donnees);
      if (fin) resoudre(new Blob(morceaux as BlobPart[], { type: 'application/zip' }));
    });
    for (const entree of entrees) {
      const fichier = new ZipPassThrough(entree.nom);
      zip.add(fichier);
      fichier.push(entree.donnees, true);
    }
    zip.end();
  });
}

async function recuperer(chemin: string): Promise<Uint8Array> {
  const reponse = await fetch(urlDuFichier(chemin));
  if (!reponse.ok) throw new Error(`${chemin} : réponse HTTP ${reponse.status}`);
  return new Uint8Array(await reponse.arrayBuffer());
}

/** Dossier racine de l'archive : « Artiste - Titre ». */
export function dossierAlbum(album: Album): string {
  return nomFichierSur(`${album.artiste} - ${album.titre}`);
}

/**
 * Télécharge les pistes d'un album et les range dans une archive ZIP construite dans le navigateur
 * (avec la pochette et un fichier de licence). `surProgression` reçoit le nombre de pistes déjà récupérées.
 */
export async function archiveAlbum(
  donnees: Donnees,
  album: Album,
  surProgression: (faites: number, total: number) => void,
): Promise<{ blob: Blob; nom: string }> {
  const pistes = pistesDeAlbum(donnees, album);
  const noms = nomsDePistes(pistes);
  const dossier = dossierAlbum(album);
  const entrees: EntreeZip[] = [];
  surProgression(0, pistes.length);
  for (const [index, piste] of pistes.entries()) {
    entrees.push({
      nom: `${dossier}/${noms[index] ?? `${index + 1}.mp3`}`,
      donnees: await recuperer(piste.fichier),
    });
    surProgression(index + 1, pistes.length);
  }
  if (album.pochette !== undefined) {
    try {
      const extension =
        /\.(png|jpe?g|webp)$/i.exec(decodeURIComponent(album.pochette))?.[0] ?? '.jpg';
      entrees.push({
        nom: `${dossier}/cover${extension.toLowerCase()}`,
        donnees: await recuperer(album.pochette),
      });
    } catch {
      // La pochette est facultative : son absence n'empêche pas le téléchargement des pistes.
    }
  }
  entrees.push({
    nom: `${dossier}/LICENSE.txt`,
    donnees: new TextEncoder().encode(texteLicence(album)),
  });
  return { blob: await construireZip(entrees), nom: `${dossier}.zip` };
}

/** Déclenche l'enregistrement d'un fichier par le navigateur. */
export function enregistrerFichier(blob: Blob, nom: string): void {
  const adresse = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = adresse;
  a.download = nom;
  document.body.append(a);
  a.click();
  a.remove();
  // Laisse au navigateur le temps de lire le blob avant de le libérer.
  window.setTimeout(() => URL.revokeObjectURL(adresse), 60_000);
}
