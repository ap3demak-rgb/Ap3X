// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { indexer } from '../src/catalogue/donnees';
import {
  motsDeRecherche,
  normaliser,
  oeuvresDeLArtiste,
  rechercher,
} from '../src/catalogue/recherche';
import type { Album, Catalogue, Piste } from '../src/catalogue/schemas';

function piste(id: string, titre: string, extras: Partial<Piste> = {}): Piste {
  return {
    id,
    titre,
    artiste: 'AP3X Records',
    description: '',
    hashtags: [],
    categorie: 'rock',
    duree: 100,
    fichier: `musique/${id}.mp3`,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    ...extras,
  };
}

const album: Album = {
  id: 'rock--ete',
  titre: 'Été indien',
  artiste: 'Zoé Dubois',
  type: 'ep',
  description: 'Chaleur',
  hashtags: ['vacances'],
  licence: 'CC BY-NC-ND 4.0',
  copyright: '© 2026 AP3X Records',
  reference: 'AP3X-042',
  categorie: 'rock',
  pistes: ['rock--ete--1'],
  nombrePistes: 1,
  duree: 100,
  telechargement: false,
};

const catalogue: Catalogue = {
  version: 1,
  categories: [
    { slug: 'rock', nom: "Rock'n'Roll", description: 'Guitares', nombrePistes: 3, nombreAlbums: 1 },
    { slug: 'techno', nom: 'Techno', description: '', nombrePistes: 1, nombreAlbums: 0 },
  ],
  albums: [album],
  pistes: [
    piste('rock--ete--1', 'Soleil', {
      album: 'rock--ete',
      artiste: 'Zoé Dubois',
      hashtags: ['vacances'],
    }),
    piste('rock--cafe', 'Café crème', { hashtags: ['matin', 'cafe-creme'] }),
    piste('rock--ete-fin', "L'été finit", { description: 'Une fin de saison' }),
    piste('techno--nuit', 'Nuit blanche', { categorie: 'techno', artiste: 'DJ X' }),
  ],
  hashtags: [
    { nom: 'vacances', pistes: ['rock--ete--1'] },
    { nom: 'matin', pistes: ['rock--cafe'] },
    { nom: 'cafe-creme', pistes: ['rock--cafe'] },
  ],
};
const donnees = indexer(catalogue);

describe('normalisation', () => {
  it('retire accents, casse et ponctuation', () => {
    expect(normaliser('Été, Ça-va !')).toBe('ete ca va');
    expect(normaliser('  ŒUVRE  ')).toBe('œuvre');
    expect(normaliser('日本語 タイトル')).toBe('日本語 タイトル');
  });

  it('découpe la requête en mots et ignore le « # » initial', () => {
    expect(motsDeRecherche('  #Café   crème ')).toEqual(['cafe', 'creme']);
    expect(motsDeRecherche('   ')).toEqual([]);
    expect(motsDeRecherche('!!!')).toEqual([]);
  });
});

describe('recherche', () => {
  it('ne renvoie rien pour une requête vide', () => {
    expect(rechercher(donnees, '').total).toBe(0);
    expect(rechercher(donnees, '  ').total).toBe(0);
  });

  it('est insensible aux accents et à la casse, dans les deux sens', () => {
    expect(rechercher(donnees, 'ete').albums.map((a) => a.id)).toEqual(['rock--ete']);
    expect(rechercher(donnees, 'ÉTÉ').albums.map((a) => a.id)).toEqual(['rock--ete']);
    expect(rechercher(donnees, 'cafe').pistes.map((p) => p.id)).toEqual(['rock--cafe']);
    expect(rechercher(donnees, 'Café').pistes.map((p) => p.id)).toEqual(['rock--cafe']);
    expect(rechercher(donnees, 'zoe').artistes.map((a) => a.nom)).toEqual(['Zoé Dubois']);
  });

  it('exige que tous les mots correspondent', () => {
    expect(rechercher(donnees, 'cafe creme').pistes).toHaveLength(1);
    expect(rechercher(donnees, 'cafe nuit').total).toBe(0);
  });

  it('cherche dans les pistes, albums, artistes, hashtags et catégories', () => {
    const resultats = rechercher(donnees, 'vacances');
    expect(resultats.pistes.map((p) => p.id)).toEqual(['rock--ete--1']);
    expect(resultats.albums.map((a) => a.id)).toEqual(['rock--ete']);
    expect(resultats.hashtags).toEqual([{ nom: 'vacances', nombre: 1 }]);
    expect(rechercher(donnees, 'techno').categories.map((c) => c.slug)).toEqual(['techno']);
    expect(rechercher(donnees, 'guitares').categories.map((c) => c.slug)).toEqual(['rock']);
    expect(rechercher(donnees, 'AP3X-042').albums).toHaveLength(1);
    expect(rechercher(donnees, 'dj').artistes).toEqual([{ nom: 'DJ X', nombre: 1 }]);
  });

  it('trouve une piste par son album, sa catégorie ou sa description', () => {
    expect(rechercher(donnees, 'indien').pistes.map((p) => p.id)).toEqual(['rock--ete--1']);
    expect(rechercher(donnees, 'techno').pistes.map((p) => p.id)).toEqual(['techno--nuit']);
    expect(rechercher(donnees, 'saison').pistes.map((p) => p.id)).toEqual(['rock--ete-fin']);
  });

  it("classe d'abord les débuts de mots du titre", () => {
    // « ete » : début du titre de « Été indien » (album) ; « L'été finit » le contient à l'intérieur.
    const pistes = rechercher(donnees, 'ete').pistes.map((p) => p.id);
    expect(pistes).toContain('rock--ete-fin');
    const titres = rechercher(donnees, 'fin').pistes.map((p) => p.id);
    expect(titres[0]).toBe('rock--ete-fin');
  });

  it('compte les pistes de chaque artiste, y compris sans piste', () => {
    const sansPiste: Catalogue = {
      ...catalogue,
      albums: [...catalogue.albums, { ...album, id: 'x', artiste: 'Solo' }],
    };
    expect(rechercher(indexer(sansPiste), 'solo').artistes).toEqual([{ nom: 'Solo', nombre: 0 }]);
    expect(rechercher(donnees, 'ap3x').artistes).toEqual([{ nom: 'AP3X Records', nombre: 2 }]);
  });

  it('retrouve le même résultat sur des recherches répétées (index mis en cache)', () => {
    expect(rechercher(donnees, 'nuit').pistes).toEqual(rechercher(donnees, 'nuit').pistes);
  });
});

describe("œuvres d'un artiste", () => {
  it('liste ses albums et ses pistes', () => {
    const oeuvres = oeuvresDeLArtiste(donnees, 'Zoé Dubois');
    expect(oeuvres.albums.map((a) => a.id)).toEqual(['rock--ete']);
    expect(oeuvres.pistes.map((p) => p.id)).toEqual(['rock--ete--1']);
    expect(oeuvresDeLArtiste(donnees, 'Inconnu')).toEqual({ albums: [], pistes: [] });
  });
});
