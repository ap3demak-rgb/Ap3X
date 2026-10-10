// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import NodeID3 from 'node-id3';
import { describe, expect, it } from 'vitest';
import { lireTagsFichier, lireTagsId3, tailleTagId3 } from '../src/admin/id3';

const octets = (b: Buffer): Uint8Array => new Uint8Array(b);
const encoder = new TextEncoder();

function synchsafe(n: number): number[] {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

/** Trame ID3v2.4 : identifiant, taille synchsafe, deux octets d'indicateurs, corps. */
function trame24(id: string, corps: number[]): number[] {
  return [...encoder.encode(id), ...synchsafe(corps.length), 0, 0, ...corps];
}

function tag24(trames: number[][]): Uint8Array<ArrayBuffer> {
  const corps = trames.flat();
  return new Uint8Array([0x49, 0x44, 0x33, 4, 0, 0, ...synchsafe(corps.length), ...corps]);
}

describe('lecture des tags ID3v2', () => {
  it('lit les champs d’un tag v2.3 écrit par node-id3, avec accents et pochette', () => {
    const image = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
    const tag = NodeID3.create({
      title: 'Été indien',
      artist: 'Zoé',
      album: 'Saisons',
      year: '2024',
      genre: 'Ambient',
      trackNumber: '3/12',
      partOfSet: '1/2',
      comment: { language: 'fra', text: 'Un titre #calme' },
      image: { mime: 'image/jpeg', type: { id: 3 }, description: 'couv', imageBuffer: image },
    });
    const tags = lireTagsId3(octets(tag));
    expect(tags).toMatchObject({
      titre: 'Été indien',
      artiste: 'Zoé',
      album: 'Saisons',
      date: '2024',
      genre: 'Ambient',
      numero: 3,
      disque: 1,
      commentaire: 'Un titre #calme',
    });
    expect(tags.pochette?.type).toBe('image/jpeg');
    expect(Array.from(tags.pochette?.donnees ?? [])).toEqual(Array.from(image));
  });

  it('lit une trame v2.4 en UTF-8 et prend la première valeur d’une liste', () => {
    const tag = tag24([
      trame24('TIT2', [3, ...encoder.encode('日本語のタイトル')]),
      trame24('TPE1', [3, ...encoder.encode('Un'), 0, ...encoder.encode('Deux')]),
      trame24('TDRC', [3, ...encoder.encode('2026-10-08T12:00')]),
    ]);
    expect(lireTagsId3(tag)).toMatchObject({
      titre: '日本語のタイトル',
      artiste: 'Un',
      date: '2026-10-08T12:00',
    });
  });

  it('décode l’UTF-16 avec et sans marque d’ordre des octets', () => {
    const avecBom = [1, 0xff, 0xfe, ...'Ça'.split('').flatMap((c) => [c.charCodeAt(0), 0])];
    const bigEndian = [2, ...'Ok'.split('').flatMap((c) => [0, c.charCodeAt(0)])];
    const tags = lireTagsId3(tag24([trame24('TIT2', avecBom), trame24('TPE1', bigEndian)]));
    expect(tags.titre).toBe('Ça');
    expect(tags.artiste).toBe('Ok');
  });

  it('lit un tag v2.2 (identifiants sur 3 caractères)', () => {
    const trame22 = (id: string, corps: number[]): number[] => [
      ...encoder.encode(id),
      0,
      0,
      corps.length,
      ...corps,
    ];
    const corps = [
      ...trame22('TT2', [0, ...encoder.encode('Vieux')]),
      ...trame22('TP1', [0, ...encoder.encode('Ancien')]),
    ];
    const tag = new Uint8Array([0x49, 0x44, 0x33, 2, 0, 0, ...synchsafe(corps.length), ...corps]);
    expect(lireTagsId3(tag)).toMatchObject({ titre: 'Vieux', artiste: 'Ancien' });
  });

  it('ignore un genre numérique de l’ID3v1 et les champs vides', () => {
    const tag = tag24([
      trame24('TCON', [0, ...encoder.encode('(17)')]),
      trame24('TIT2', [0]),
      trame24('TPE1', [0, ...encoder.encode('Moi')]),
    ]);
    const tags = lireTagsId3(tag);
    expect(tags.genre).toBeUndefined();
    expect(tags.titre).toBeUndefined();
    expect(tags.artiste).toBe('Moi');
  });

  it('ne plante pas sur des octets sans tag, tronqués ou aléatoires', () => {
    expect(lireTagsId3(new Uint8Array([1, 2, 3]))).toEqual({});
    expect(lireTagsId3(new Uint8Array(100).fill(0xff))).toEqual({});
    const complet = tag24([trame24('TIT2', [3, ...encoder.encode('Titre long')])]);
    expect(() => lireTagsId3(complet.subarray(0, 14))).not.toThrow();
    for (let i = 0; i < 50; i += 1) {
      const bruit = new Uint8Array(complet.length).map(() => Math.floor(Math.random() * 256));
      bruit.set(complet.subarray(0, 10));
      expect(() => lireTagsId3(bruit)).not.toThrow();
    }
  });

  it('calcule la taille du tag et lit un Blob en ne chargeant que le début', async () => {
    const tag = tag24([trame24('TIT2', [3, ...encoder.encode('Blob')])]);
    expect(tailleTagId3(tag)).toBe(tag.length);
    const mp3 = new Blob([tag, new Uint8Array(5000).fill(0xff)]);
    expect((await lireTagsFichier(mp3)).titre).toBe('Blob');
    expect(await lireTagsFichier(new Blob([new Uint8Array(50)]))).toEqual({});
  });
});
