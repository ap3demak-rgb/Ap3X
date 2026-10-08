// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { indexer } from '../src/catalogue/donnees';
import {
  albumsDeCategorie,
  albumsDuHashtag,
  CATEGORIE_TOUT,
  estCleTri,
  fileDeLecture,
  hashtagsPopulaires,
  niveauNuage,
  pistesDeCategorie,
  pistesDuHashtag,
  pistesHorsAlbum,
  trierAlbums,
  trierPistes,
} from '../src/catalogue/navigation';
import type { Album, Catalogue, Piste } from '../src/catalogue/schemas';

function piste(id: string, categorie: string, extras: Partial<Piste> = {}): Piste {
  return {
    id,
    titre: id,
    artiste: 'AP3X Records',
    description: '',
    hashtags: [],
    categorie,
    duree: 100,
    fichier: `musique/${id}.mp3`,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    ...extras,
  };
}

function album(
  id: string,
  categorie: string,
  pistes: string[],
  extras: Partial<Album> = {},
): Album {
  return {
    id,
    titre: id,
    artiste: 'AP3X Records',
    type: 'ep',
    description: '',
    hashtags: [],
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    categorie,
    pistes,
    nombrePistes: pistes.length,
    duree: pistes.length * 100,
    ...extras,
  };
}

const catalogue: Catalogue = {
  version: 1,
  categories: [
    { slug: 'rock', nom: 'Rock', description: '', nombrePistes: 4, nombreAlbums: 1 },
    { slug: 'techno', nom: 'Techno', description: '', nombrePistes: 3, nombreAlbums: 1 },
  ],
  albums: [
    album('rock--a', 'rock', ['rock--a--1', 'rock--a--2']),
    album('techno--b', 'techno', ['techno--1']),
  ],
  pistes: [
    piste('rock--a--1', 'rock', { album: 'rock--a', date: '2024', hashtags: ['live'] }),
    piste('rock--a--2', 'rock', { album: 'rock--a', date: '2024' }),
    piste('rock--3', 'rock', { date: '2023', hashtags: ['live', 'demo'] }),
    piste('techno--1', 'techno', { album: 'techno--b', date: '2025', hashtags: ['demo'] }),
    piste('techno--2', 'techno', { autresCategories: ['rock'] }),
  ],
  hashtags: [],
};
const donnees = indexer(catalogue);

describe('catégories', () => {
  it('range une piste dans sa catégorie et dans ses catégories supplémentaires', () => {
    expect(pistesDeCategorie(donnees, 'rock').map((p) => p.id)).toEqual([
      'rock--a--1',
      'rock--a--2',
      'rock--3',
      'techno--2',
    ]);
    expect(pistesDeCategorie(donnees, 'techno').map((p) => p.id)).toEqual([
      'techno--1',
      'techno--2',
    ]);
    expect(pistesDeCategorie(donnees, CATEGORIE_TOUT)).toHaveLength(5);
    expect(albumsDeCategorie(donnees, 'techno').map((a) => a.id)).toEqual(['techno--b']);
    expect(albumsDeCategorie(donnees, CATEGORIE_TOUT)).toHaveLength(2);
  });

  it('isole les pistes hors album', () => {
    expect(pistesHorsAlbum(catalogue.pistes).map((p) => p.id)).toEqual(['rock--3', 'techno--2']);
  });

  it('construit la file de lecture : albums puis pistes hors album', () => {
    const albums = albumsDeCategorie(donnees, 'rock');
    const seules = pistesHorsAlbum(pistesDeCategorie(donnees, 'rock'));
    expect(fileDeLecture(donnees, albums, seules).map((p) => p.id)).toEqual([
      'rock--a--1',
      'rock--a--2',
      'rock--3',
      'techno--2',
    ]);
  });
});

describe('tris', () => {
  it('reconnaît les clés de tri valides', () => {
    expect(estCleTri('duree')).toBe(true);
    expect(estCleTri('hasard')).toBe(false);
  });

  it('trie les pistes selon chaque critère', () => {
    const toutes = catalogue.pistes;
    expect(trierPistes(toutes, 'titre', 'en').map((p) => p.id)).toEqual([
      'rock--3',
      'rock--a--1',
      'rock--a--2',
      'techno--1',
      'techno--2',
    ]);
    // Sans date = plus ancien.
    expect(trierPistes(toutes, 'ancien', 'en')[0]?.id).toBe('techno--2');
    expect(trierPistes(toutes, 'recent', 'en')[0]?.id).toBe('techno--1');
    const longues = toutes.map((p) => (p.id === 'rock--3' ? { ...p, duree: 500 } : p));
    expect(trierPistes(longues, 'duree', 'en')[0]?.id).toBe('rock--3');
    const artistes = toutes.map((p) => (p.id === 'rock--3' ? { ...p, artiste: 'Abel' } : p));
    expect(trierPistes(artistes, 'artiste', 'en')[0]?.id).toBe('rock--3');
  });

  it('trie sans tenir compte des accents ni de la casse, et de façon stable', () => {
    const titres = ['zèbre', 'Été', 'abricot', 'Eau'].map((titre, i) =>
      piste(`p${i}`, 'rock', { titre }),
    );
    expect(trierPistes(titres, 'titre', 'fr').map((p) => p.titre)).toEqual([
      'abricot',
      'Eau',
      'Été',
      'zèbre',
    ]);
    const memeTitre = ['b', 'a', 'c'].map((id) => piste(id, 'rock', { titre: 'Idem' }));
    expect(trierPistes(memeTitre, 'titre', 'en').map((p) => p.id)).toEqual(['a', 'b', 'c']);
  });

  it('trie les albums, par durée notamment', () => {
    expect(trierAlbums(catalogue.albums, 'duree', 'en')[0]?.id).toBe('rock--a');
  });

  it("ne modifie pas le tableau d'origine", () => {
    const avant = catalogue.pistes.map((p) => p.id);
    trierPistes(catalogue.pistes, 'titre', 'en');
    expect(catalogue.pistes.map((p) => p.id)).toEqual(avant);
  });
});

describe('hashtags', () => {
  it('classe les hashtags par popularité puis par nom', () => {
    const avecTags: Catalogue = {
      ...catalogue,
      hashtags: [
        { nom: 'demo', pistes: ['a', 'b'] },
        { nom: 'live', pistes: ['a', 'b'] },
        { nom: 'zen', pistes: ['a', 'b', 'c'] },
        { nom: 'solo', pistes: ['a'] },
      ],
    };
    expect(hashtagsPopulaires(avecTags, 3)).toEqual([
      { nom: 'zen', nombre: 3 },
      { nom: 'demo', nombre: 2 },
      { nom: 'live', nombre: 2 },
    ]);
  });

  it("retrouve les pistes et albums d'un hashtag", () => {
    expect(pistesDuHashtag(donnees, 'live').map((p) => p.id)).toEqual(['rock--a--1', 'rock--3']);
    const avecAlbumTag: Catalogue = {
      ...catalogue,
      albums: catalogue.albums.map((a) =>
        a.id === 'techno--b' ? { ...a, hashtags: ['live'] } : a,
      ),
    };
    expect(albumsDuHashtag(indexer(avecAlbumTag), 'live').map((a) => a.id)).toEqual(['techno--b']);
    expect(albumsDuHashtag(donnees, 'inconnu')).toEqual([]);
  });

  it("calcule la taille d'un hashtag dans le nuage entre 1 et 5", () => {
    expect(niveauNuage(1, 1, 9)).toBe(1);
    expect(niveauNuage(9, 1, 9)).toBe(5);
    expect(niveauNuage(5, 1, 9)).toBe(3);
    expect(niveauNuage(4, 4, 4)).toBe(3);
  });
});
