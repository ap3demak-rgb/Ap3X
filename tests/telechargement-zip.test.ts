// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { crc32 } from 'node:zlib';
import { unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import type { Album, Piste } from '../src/catalogue/schemas';
import {
  construireZip,
  dossierAlbum,
  nomFichierSur,
  nomsDePistes,
  texteLicence,
} from '../src/telechargement-zip';

function piste(titre: string, extras: Partial<Piste> = {}): Piste {
  return {
    id: titre,
    titre,
    artiste: 'AP3X Records',
    description: '',
    hashtags: [],
    categorie: 'rock',
    duree: 100,
    fichier: `musique/${titre}.mp3`,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    ...extras,
  };
}

const album: Album = {
  id: 'rock--ep',
  titre: 'Mon EP : été/hiver?',
  artiste: 'Zoé "Z" Dubois',
  type: 'ep',
  description: '',
  hashtags: [],
  licence: 'CC BY-NC-ND 4.0',
  copyright: '© 2024 Zoé Dubois',
  reference: 'AP3X-007',
  categorie: 'rock',
  pistes: [],
  nombrePistes: 0,
  duree: 0,
  telechargement: true,
};

describe('noms de fichiers', () => {
  it('retire les caractères interdits et les points ou espaces finaux', () => {
    expect(nomFichierSur('a/b\\c:d*e?f"g<h>i|j')).toBe('a_b_c_d_e_f_g_h_i_j');
    expect(nomFichierSur('  Titre...  ')).toBe('Titre');
    expect(nomFichierSur('.cache')).toBe('_cache');
    expect(nomFichierSur('a\u0000b\tc')).toBe('a_b_c');
    expect(nomFichierSur('   ')).toBe('_');
    expect(nomFichierSur('日本語のタイトル')).toBe('日本語のタイトル');
  });

  it('borne la longueur sans couper un caractère en deux', () => {
    expect([...nomFichierSur('é'.repeat(300), 50)]).toHaveLength(50);
    expect([...nomFichierSur('😀'.repeat(300), 10)]).toHaveLength(10);
  });

  it('numérote les pistes, sur un ou plusieurs disques, sans doublon', () => {
    expect(nomsDePistes([piste('A'), piste('B')])).toEqual(['01 - A.mp3', '02 - B.mp3']);
    expect(
      nomsDePistes([piste('A', { disque: 1, numero: 1 }), piste('B', { disque: 2, numero: 1 })]),
    ).toEqual(['1-01 - A.mp3', '2-01 - B.mp3']);
    expect(nomsDePistes([piste('Idem'), piste('idem')])).toEqual([
      '01 - Idem.mp3',
      '02 - idem.mp3',
    ]);
    expect(nomsDePistes([piste('X', { numero: 1 }), piste('X', { numero: 1 })])).toEqual([
      '01 - X.mp3',
      '01 - X (2).mp3',
    ]);
    const douze = Array.from({ length: 12 }, (_, i) => piste(`T${i}`));
    expect(nomsDePistes(douze)[0]).toBe('01 - T0.mp3');
    const cent = Array.from({ length: 100 }, (_, i) => piste(`T${i}`));
    expect(nomsDePistes(cent)[0]).toBe('001 - T0.mp3');
  });

  it("nomme le dossier de l'album et rédige l'attribution", () => {
    expect(dossierAlbum(album)).toBe('Zoé _Z_ Dubois - Mon EP _ été_hiver_');
    const texte = texteLicence(album);
    expect(texte).toContain('© 2024 Zoé Dubois');
    expect(texte).toContain('License: CC BY-NC-ND 4.0');
    expect(texte).toContain('Catalogue reference: AP3X-007');
    expect(texte).toContain('Source: https://github.com/ap3demak-rgb/Ap3X');
    expect(texteLicence({ ...album, reference: undefined })).not.toContain('Catalogue reference');
  });
});

describe('archive ZIP', () => {
  it('contient chaque fichier intact, avec son empreinte', async () => {
    const audio = Uint8Array.from({ length: 5000 }, (_, i) => (i * 7) % 256);
    const texte = new TextEncoder().encode('Licence – été');
    const blob = await construireZip([
      { nom: 'Dossier/01 - Été.mp3', donnees: audio },
      { nom: 'Dossier/LICENSE.txt', donnees: texte },
      { nom: 'Dossier/vide.bin', donnees: new Uint8Array(0) },
    ]);
    expect(blob.type).toBe('application/zip');
    const lu = unzipSync(new Uint8Array(await blob.arrayBuffer()));
    expect(Object.keys(lu).sort()).toEqual([
      'Dossier/01 - Été.mp3',
      'Dossier/LICENSE.txt',
      'Dossier/vide.bin',
    ]);
    expect(Buffer.from(lu['Dossier/01 - Été.mp3'] ?? []).equals(Buffer.from(audio))).toBe(true);
    expect(crc32(lu['Dossier/01 - Été.mp3'] ?? new Uint8Array())).toBe(crc32(audio));
    expect(new TextDecoder().decode(lu['Dossier/LICENSE.txt'])).toBe('Licence – été');
    expect(lu['Dossier/vide.bin']?.length).toBe(0);
  });

  it("n'applique aucune compression : la taille reste celle des données", async () => {
    const donnees = new Uint8Array(100_000);
    const blob = await construireZip([{ nom: 'a.bin', donnees }]);
    expect(blob.size).toBeGreaterThanOrEqual(100_000);
    expect(blob.size).toBeLessThan(100_300);
  });

  it('produit une archive valide sans aucune entrée', async () => {
    const blob = await construireZip([]);
    expect(Object.keys(unzipSync(new Uint8Array(await blob.arrayBuffer())))).toEqual([]);
  });
});
