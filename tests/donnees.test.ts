// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  albumsLies,
  filtrerAlbums,
  indexer,
  pistesDeAlbum,
  pistesSimilaires,
  plusRecents,
} from '../src/catalogue/donnees';
import type { Album, Catalogue, Piste } from '../src/catalogue/schemas';

function piste(id: string, categorie: string, hashtags: string[] = [], date?: string): Piste {
  return {
    id,
    titre: id,
    artiste: 'AP3X Records',
    description: '',
    hashtags,
    categorie,
    ...(date !== undefined && { date }),
    duree: 100,
    fichier: `musique/${id}.mp3`,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
  };
}

function album(
  id: string,
  categorie: string,
  type: Album['type'],
  date: string | undefined,
  pistes: string[],
): Album {
  return {
    id,
    titre: id,
    artiste: id.startsWith('z') ? 'Autre' : 'AP3X Records',
    type,
    ...(date !== undefined && { date }),
    description: '',
    hashtags: [],
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    categorie,
    pistes,
    nombrePistes: pistes.length,
    duree: pistes.length * 100,
  };
}

const catalogue: Catalogue = {
  version: 1,
  categories: [
    { slug: 'rock', nom: 'Rock', description: '', nombrePistes: 3, nombreAlbums: 1 },
    { slug: 'techno', nom: 'Techno', description: '', nombrePistes: 2, nombreAlbums: 2 },
  ],
  albums: [
    album('rock--a', 'rock', 'ep', '2024-05', ['rock--a--1', 'rock--a--2']),
    album('techno--b', 'techno', 'single', '2025', ['techno--1']),
    album('zeta', 'techno', 'lp', undefined, ['techno--2']),
  ],
  pistes: [
    piste('rock--a--1', 'rock', ['live'], '2024-05'),
    piste('rock--a--2', 'rock', [], '2024-05'),
    piste('rock--3', 'rock', ['live', 'demo'], '2023'),
    piste('techno--1', 'techno', ['demo'], '2025'),
    piste('techno--2', 'techno'),
  ],
  hashtags: [],
};
const donnees = indexer(catalogue);

describe('données du catalogue', () => {
  it("liste les pistes d'un album dans l'ordre", () => {
    const a = donnees.albums.get('rock--a');
    expect(a && pistesDeAlbum(donnees, a).map((p) => p.id)).toEqual(['rock--a--1', 'rock--a--2']);
  });

  it('trie du plus récent au plus ancien, sans date en dernier', () => {
    expect(plusRecents(catalogue.pistes, 3).map((p) => p.id)).toEqual([
      'techno--1',
      'rock--a--1',
      'rock--a--2',
    ]);
    expect(plusRecents(catalogue.albums, 5).map((a) => a.id)).toEqual([
      'techno--b',
      'rock--a',
      'zeta',
    ]);
  });

  it('trouve les pistes similaires par hashtags puis par catégorie', () => {
    const base = donnees.pistes.get('rock--3');
    if (base === undefined) throw new Error('piste de test absente');
    // rock--a--1 : live en commun (2) + même catégorie (1) ; techno--1 : demo en commun (2).
    expect(pistesSimilaires(donnees, base, 5).map((p) => p.id)).toEqual([
      'rock--a--1',
      'techno--1',
      'rock--a--2',
    ]);
    const isolee = donnees.pistes.get('techno--2');
    if (isolee === undefined) throw new Error('piste de test absente');
    expect(pistesSimilaires(donnees, isolee, 5).map((p) => p.id)).toEqual(['techno--1']);
  });

  it('retrouve les albums de la même catégorie ou du même artiste', () => {
    const b = donnees.albums.get('techno--b');
    if (b === undefined) throw new Error('album de test absent');
    // zeta : même catégorie ; rock--a : même artiste.
    expect(albumsLies(donnees, b, 5).map((a) => a.id)).toEqual(['rock--a', 'zeta']);
  });

  it('filtre et trie les albums', () => {
    const tous = { type: '', categorie: '', annee: '', tri: 'recent' as const };
    expect(filtrerAlbums(catalogue.albums, tous).map((a) => a.id)).toEqual([
      'techno--b',
      'rock--a',
      'zeta',
    ]);
    expect(filtrerAlbums(catalogue.albums, { ...tous, tri: 'ancien' }).map((a) => a.id)).toEqual([
      'zeta',
      'rock--a',
      'techno--b',
    ]);
    expect(
      filtrerAlbums(catalogue.albums, { ...tous, categorie: 'techno' }).map((a) => a.id),
    ).toEqual(['techno--b', 'zeta']);
    expect(filtrerAlbums(catalogue.albums, { ...tous, type: 'ep' }).map((a) => a.id)).toEqual([
      'rock--a',
    ]);
    expect(filtrerAlbums(catalogue.albums, { ...tous, annee: '2024' }).map((a) => a.id)).toEqual([
      'rock--a',
    ]);
    expect(filtrerAlbums(catalogue.albums, { ...tous, annee: '1999' })).toEqual([]);
  });
});
