// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import type { PisteDepot } from '../src/admin/depot';
import { dimensionsReduites } from '../src/admin/image';
import {
  filtrerLignes,
  hashtagsDeLaListe,
  lignePiste,
  lireResumeFiche,
  type CriteresListe,
} from '../src/admin/liste';

const piste = (categorie: string, base: string, album?: string): PisteDepot => ({
  categorie,
  base,
  ...(album !== undefined && { album }),
  mp3: { chemin: `public/musique/${categorie}/${base}.mp3`, sha: 's' },
});

const LIGNES = [
  lignePiste(piste('techno', '300'), {
    titre: 'Trois Cents',
    artiste: 'AP3X Records',
    hashtags: ['nuit', 'club'],
    visible: true,
  }),
  lignePiste(piste('ambient', 'brume'), { titre: 'Brume', hashtags: ['nuit'], visible: false }),
  lignePiste(piste('ambient', 'etoile_filante', 'Ciel')),
  lignePiste(piste('Deep House', 'zeta'), { titre: 'Été', hashtags: ['calme'], visible: true }),
];

const criteres = (surcharge: Partial<CriteresListe> = {}): CriteresListe => ({
  recherche: '',
  categorie: '',
  hashtag: '',
  tri: 'titre',
  ...surcharge,
});
const titres = (lignes: ReturnType<typeof filtrerLignes>): string[] => lignes.map((l) => l.titre);

describe('résumé de fiche', () => {
  it('lit titre, artiste, hashtags et visibilité', () => {
    expect(
      lireResumeFiche('{"titre":"A","artiste":"B","hashtags":["x",3,"y"],"visible":false}'),
    ).toEqual({ titre: 'A', artiste: 'B', hashtags: ['x', 'y'], visible: false });
  });

  it('tolère un JSON illisible ou inattendu', () => {
    expect(lireResumeFiche('pas du json')).toEqual({ hashtags: [], visible: true });
    expect(lireResumeFiche('[1]')).toEqual({ hashtags: [], visible: true });
    expect(lireResumeFiche('null')).toEqual({ hashtags: [], visible: true });
  });
});

describe('liste des pistes', () => {
  it('prend le titre du nom de fichier quand il n’y a pas de fiche', () => {
    expect(LIGNES[2]?.titre).toBe('etoile filante');
    expect(LIGNES[2]?.album).toBe('Ciel');
    expect(LIGNES[2]?.id).toBe('ambient--ciel--etoile-filante');
  });

  it('classe les hashtags par fréquence puis par ordre alphabétique', () => {
    expect(hashtagsDeLaListe(LIGNES)).toEqual(['nuit', 'calme', 'club']);
  });

  it('trie par titre, ou par catégorie puis titre', () => {
    expect(titres(filtrerLignes(LIGNES, criteres()))).toEqual([
      'Brume',
      'Été',
      'etoile filante',
      'Trois Cents',
    ]);
    expect(titres(filtrerLignes(LIGNES, criteres({ tri: 'categorie' })))).toEqual([
      'Brume',
      'etoile filante',
      'Été',
      'Trois Cents',
    ]);
  });

  it('cherche sans tenir compte des accents ni de la casse, dans tous les champs', () => {
    expect(titres(filtrerLignes(LIGNES, criteres({ recherche: 'ete' })))).toEqual(['Été']);
    expect(titres(filtrerLignes(LIGNES, criteres({ recherche: 'AP3X trois' })))).toEqual([
      'Trois Cents',
    ]);
    expect(titres(filtrerLignes(LIGNES, criteres({ recherche: 'ciel' })))).toEqual([
      'etoile filante',
    ]);
    expect(titres(filtrerLignes(LIGNES, criteres({ recherche: 'zzz' })))).toEqual([]);
  });

  it('filtre par catégorie et par hashtag', () => {
    expect(titres(filtrerLignes(LIGNES, criteres({ categorie: 'ambient' })))).toEqual([
      'Brume',
      'etoile filante',
    ]);
    expect(titres(filtrerLignes(LIGNES, criteres({ hashtag: 'nuit' })))).toEqual([
      'Brume',
      'Trois Cents',
    ]);
    expect(
      titres(filtrerLignes(LIGNES, criteres({ hashtag: 'nuit', categorie: 'techno' }))),
    ).toEqual(['Trois Cents']);
  });
});

describe('dimensions de pochette', () => {
  it('réduit en gardant les proportions et n’agrandit jamais', () => {
    expect(dimensionsReduites({ largeur: 3000, hauteur: 1500 })).toEqual({
      largeur: 1200,
      hauteur: 600,
    });
    expect(dimensionsReduites({ largeur: 800, hauteur: 600 })).toEqual({
      largeur: 800,
      hauteur: 600,
    });
    expect(dimensionsReduites({ largeur: 5000, hauteur: 1 }, 1200)).toEqual({
      largeur: 1200,
      hauteur: 1,
    });
  });
});
