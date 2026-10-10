// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { analyserArbre, identifiantPisteDepot } from '../src/admin/depot';
import {
  cheminsPiste,
  construireFiche,
  dossierCategorie,
  formulaireVide,
  lireHashtags,
  nomFichierPiste,
  verifierFormulaire,
} from '../src/admin/fiche';
import type { EntreeArbre } from '../src/admin/github';
import { FichePisteSchema } from '../src/catalogue/schemas';

const blob = (chemin: string): EntreeArbre => ({
  chemin,
  type: 'blob',
  sha: `sha-${chemin}`,
  taille: 1,
});
const dossier = (chemin: string): EntreeArbre => ({ chemin, type: 'tree', sha: 't', taille: 0 });

const ARBRE: EntreeArbre[] = [
  blob('package.json'),
  dossier('public'),
  dossier('public/musique'),
  dossier('public/musique/techno'),
  blob('public/musique/techno/300.mp3'),
  blob('public/musique/techno/300.json'),
  blob('public/musique/techno/300.webp'),
  blob('public/musique/techno/cover.jpg'),
  dossier('public/musique/Deep House'),
  dossier('public/musique/Deep House/Mon Album'),
  blob('public/musique/Deep House/Mon Album/01 intro.mp3'),
  blob('public/musique/Deep House/Mon Album/album.json'),
  blob('public/musique/Deep House/seul.mp3'),
  blob('public/musique/orphelin.mp3'),
];

describe("analyse de l'arbre du dépôt", () => {
  const depot = analyserArbre(ARBRE);

  it("trouve les catégories, les pistes seules et celles d'un album", () => {
    expect(depot.categories).toEqual(['Deep House', 'techno']);
    expect(depot.pistes.map((p) => p.mp3.chemin)).toEqual([
      'public/musique/Deep House/Mon Album/01 intro.mp3',
      'public/musique/Deep House/seul.mp3',
      'public/musique/techno/300.mp3',
    ]);
    expect(depot.pistes[0]).toMatchObject({ categorie: 'Deep House', album: 'Mon Album' });
    expect(depot.pistes[2]?.album).toBeUndefined();
  });

  it("associe la fiche et l'image qui portent le même nom, mais pas cover.jpg", () => {
    const piste = depot.pistes[2];
    expect(piste?.fiche?.chemin).toBe('public/musique/techno/300.json');
    expect(piste?.image?.chemin).toBe('public/musique/techno/300.webp');
    expect(depot.pistes[1]?.fiche).toBeUndefined();
  });

  it('calcule les identifiants comme le générateur du catalogue', () => {
    expect(depot.pistes.map(identifiantPisteDepot)).toEqual([
      'deep-house--mon-album--01-intro',
      'deep-house--seul',
      'techno--300',
    ]);
  });

  it('ignore un MP3 posé hors d une catégorie', () => {
    expect(depot.pistes.some((p) => p.base === 'orphelin')).toBe(false);
  });
});

describe("formulaire d'une piste", () => {
  const depot = analyserArbre(ARBRE);
  const valide = { ...formulaireVide('techno'), titre: 'Nuit Blanche' };

  it('lit les hashtags de façon tolérante', () => {
    expect(lireHashtags('#Nuit, calme  #nuit;Deep House')).toEqual([
      'nuit',
      'calme',
      'deep',
      'house',
    ]);
    expect(lireHashtags('')).toEqual([]);
  });

  it("déduit le dossier d'une catégorie : existante telle quelle, nouvelle en slug", () => {
    expect(dossierCategorie('Deep House', depot.categories)).toBe('Deep House');
    expect(dossierCategorie('  Drum & Bass ', depot.categories)).toBe('drum-bass');
    expect(dossierCategorie('   ', depot.categories)).toBe('');
  });

  it('construit le nom de fichier et les chemins', () => {
    expect(nomFichierPiste('Été — Indien !')).toBe('ete-indien');
    expect(nomFichierPiste('???')).toBe('piste');
    expect(cheminsPiste('techno', 'x')).toMatchObject({
      mp3: 'public/musique/techno/x.mp3',
      fiche: 'public/musique/techno/x.json',
    });
    expect(cheminsPiste('techno', 'x').image('.webp')).toBe('public/musique/techno/x.webp');
  });

  it('accepte un formulaire correct', () => {
    expect(verifierFormulaire(valide, true, depot)).toEqual([]);
  });

  it('signale fichier, titre, catégorie et date invalides', () => {
    const erreurs = verifierFormulaire(
      { ...valide, titre: ' ', categorie: ' ', date: '2024-5' },
      false,
      depot,
    );
    expect(erreurs.map((e) => e.champ).sort()).toEqual(['categorie', 'date', 'fichier', 'titre']);
    for (const date of ['2024', '2024-05', '2024-05-03']) {
      expect(verifierFormulaire({ ...valide, date }, true, depot)).toEqual([]);
    }
    expect(verifierFormulaire({ ...valide, date: '2024-05-03T10:00' }, true, depot)).toEqual([
      { champ: 'date' },
    ]);
  });

  it("refuse un doublon d'identifiant, quelle que soit la casse", () => {
    expect(verifierFormulaire({ ...valide, titre: '300' }, true, depot)).toEqual([
      { champ: 'doublon', id: 'techno--300' },
    ]);
    expect(
      verifierFormulaire({ ...valide, categorie: 'Deep House', titre: 'SEUL' }, true, depot),
    ).toEqual([{ champ: 'doublon', id: 'deep-house--seul' }]);
  });

  it('écrit une fiche minimale et valide pour le schéma du catalogue', () => {
    const json = construireFiche(
      { ...valide, artiste: 'AP3X Records', hashtags: '#nuit calme' },
      'nuit-blanche.webp',
    );
    const fiche = JSON.parse(json) as Record<string, unknown>;
    expect(fiche).toEqual({
      titre: 'Nuit Blanche',
      artiste: 'AP3X Records',
      hashtags: ['nuit', 'calme'],
      pochette: 'nuit-blanche.webp',
      copyright: '© 2026 AP3X Records',
    });
    expect(FichePisteSchema.parse(fiche).visible).toBe(true);
    expect(json.endsWith('\n')).toBe(true);
  });

  it("écrit les choix qui s'écartent des valeurs par défaut (brouillon, téléchargement, licence, date)", () => {
    const fiche = JSON.parse(
      construireFiche({
        ...valide,
        visible: false,
        telechargement: true,
        licence: 'CC BY 4.0',
        date: '2026-10',
        description: ' Un morceau #calme ',
      }),
    ) as Record<string, unknown>;
    expect(fiche).toMatchObject({
      visible: false,
      telechargement: true,
      licence: 'CC BY 4.0',
      date: '2026-10',
      description: 'Un morceau #calme',
    });
  });

  it("refuse d'écrire une fiche invalide", () => {
    expect(() => construireFiche({ ...valide, date: 'hier' })).toThrow();
  });
});
