// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  FONDS_SITE,
  formulaireDepuisCategorie,
  ligneCategorie,
  planCreationCategorie,
  planModificationCategorie,
  planOrdreCategories,
  planSuppressionCategorie,
  ratioCouleur,
  trierCategories,
} from '../src/admin/categories';
import { analyserArbre } from '../src/admin/depot';
import type { FicheBrute } from '../src/admin/edition';
import type { Changement, EntreeArbre } from '../src/admin/github';

const blob = (chemin: string): EntreeArbre => ({
  chemin,
  type: 'blob',
  sha: `sha:${chemin}`,
  taille: 1,
});

const ARBRE = [
  'public/musique/ambient/brume.mp3',
  'public/musique/ambient/brume.json',
  'public/musique/ambient/categorie.json',
  'public/musique/ambient/cover.jpg',
  'public/musique/ambient/Nuit/album.json',
  'public/musique/ambient/Nuit/lune.mp3',
  'public/musique/techno/300.mp3',
  'public/musique/techno/Nuit/album.json',
  'public/musique/techno/Nuit/x.mp3',
  'public/musique/Deep House/a.mp3',
  'public/musique/vide/categorie.json',
];
const depot = analyserArbre(ARBRE.map(blob));
const cat = (dossier: string) => {
  const trouvee = depot.categoriesDepot.find((c) => c.dossier === dossier);
  if (trouvee === undefined) throw new Error(`catégorie absente : ${dossier}`);
  return trouvee;
};
const chemins = (c: Changement[]): string[] => c.map((x) => x.chemin).sort();
const contenu = (c: Changement[], fin: string): FicheBrute =>
  JSON.parse((c.find((x) => x.chemin.endsWith(fin)) as { contenu: string }).contenu) as FicheBrute;

describe('lecture des catégories du dépôt', () => {
  it('trouve fiche, pochette, pistes et albums de chaque dossier', () => {
    const ambient = cat('ambient');
    expect(ambient.fiche?.chemin).toBe('public/musique/ambient/categorie.json');
    expect(ambient.images.map((i) => i.chemin)).toEqual(['public/musique/ambient/cover.jpg']);
    expect(ambient.pistes.map((p) => p.base).sort()).toEqual(['brume', 'lune']);
    expect(ambient.albums.map((a) => a.dossier)).toEqual(['Nuit']);
    expect(cat('vide').fichiers.map((f) => f.chemin)).toEqual([
      'public/musique/vide/categorie.json',
    ]);
    expect(cat('Deep House').fiche).toBeUndefined();
  });

  it('déduit nom et lignes de liste, sans fiche ou avec fiche', () => {
    expect(formulaireDepuisCategorie(cat('Deep House'), undefined)).toEqual({
      nom: 'Deep House',
      description: '',
      couleur: '',
    });
    const ligne = ligneCategorie(cat('ambient'), { nom: 'Ambiance', couleur: '#ffcc00', ordre: 2 });
    expect(ligne).toMatchObject({ nom: 'Ambiance', ordre: 2, pistes: 2, albums: 1 });
  });

  it('trie comme le site : ceux qui ont un ordre d’abord, puis par nom', () => {
    const lignes = [
      ligneCategorie(cat('techno'), undefined),
      ligneCategorie(cat('ambient'), { ordre: 2 }),
      ligneCategorie(cat('Deep House'), { ordre: 1 }),
      ligneCategorie(cat('vide'), undefined),
    ];
    expect(trierCategories(lignes).map((l) => l.dossier)).toEqual([
      'Deep House',
      'ambient',
      'techno',
      'vide',
    ]);
  });
});

describe('contraste de la couleur', () => {
  it('les fonds utilisés sont ceux du thème', () => {
    const theme = readFileSync('src/styles/theme.css', 'utf8');
    expect(theme).toContain(`--fond: ${FONDS_SITE[0]};`);
    expect(theme).toContain(`--fond-3d-max: ${FONDS_SITE[1]};`);
  });

  it('prend le plus petit ratio sur les deux fonds et refuse une couleur invalide', () => {
    expect(ratioCouleur('#ffffff')).toBeGreaterThan(10);
    expect(ratioCouleur('#000000')).toBeLessThan(1.2);
    expect(ratioCouleur('rouge')).toBeUndefined();
    expect(ratioCouleur('#fff')).toBeUndefined();
  });
});

describe('création d’une catégorie', () => {
  const formulaire = { nom: 'Drum & Bass', description: 'Rapide', couleur: '#FFCC00' };

  it('crée le dossier avec sa fiche et sa pochette', () => {
    const plan = planCreationCategorie({
      formulaire,
      pochette: { octets: new Uint8Array([1]), extension: '.webp' },
      depot,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.dossier).toBe('drum-bass');
    expect(plan.message).toBe('ajout: catégorie « Drum & Bass »');
    expect(chemins(plan.changements)).toEqual([
      'public/musique/drum-bass/categorie.json',
      'public/musique/drum-bass/cover.webp',
    ]);
    expect(contenu(plan.changements, 'categorie.json')).toEqual({
      nom: 'Drum & Bass',
      description: 'Rapide',
      couleur: '#ffcc00',
    });
  });

  it('refuse nom vide, nom réservé, doublon, couleur invalide ou trop sombre', () => {
    const erreurs = (surcharge: Partial<typeof formulaire>) => {
      const plan = planCreationCategorie({ formulaire: { ...formulaire, ...surcharge }, depot });
      return plan.ok ? [] : plan.erreurs.map((e) => e.champ);
    };
    expect(erreurs({ nom: '  ' })).toEqual(['nom']);
    expect(erreurs({ nom: '???' })).toEqual(['nom']);
    expect(erreurs({ nom: 'Tout' })).toEqual(['reserve']);
    expect(erreurs({ nom: 'FAVORIS' })).toEqual(['reserve']);
    expect(erreurs({ nom: 'Deep   house' })).toEqual(['doublon']);
    expect(erreurs({ nom: 'Techno' })).toEqual(['doublon']);
    expect(erreurs({ couleur: 'jaune' })).toEqual(['couleur']);
    expect(erreurs({ couleur: '#111111' })).toEqual(['contraste']);
    expect(erreurs({ couleur: '' })).toEqual([]);
  });
});

describe('modification d’une catégorie', () => {
  const ambient = cat('ambient');
  const fiche: FicheBrute = { nom: 'Ambient', couleur: '#ffcc00', ordre: 3 };
  const formulaire = formulaireDepuisCategorie(ambient, fiche);

  it('ne fait rien sans changement', () => {
    expect(planModificationCategorie({ categorie: ambient, fiche, formulaire })).toMatchObject({
      ok: true,
      changements: [],
    });
  });

  it('change nom, description et couleur en gardant l’ordre', () => {
    const plan = planModificationCategorie({
      categorie: ambient,
      fiche,
      formulaire: { nom: 'Ambiance', description: 'Calme', couleur: '' },
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(chemins(plan.changements)).toEqual(['public/musique/ambient/categorie.json']);
    expect(contenu(plan.changements, 'categorie.json')).toEqual({
      nom: 'Ambiance',
      description: 'Calme',
      ordre: 3,
    });
    expect(plan.dossier).toBe('ambient');
  });

  it('remplace la pochette : nouvelle image, ancienne retirée, déclaration retirée', () => {
    const plan = planModificationCategorie({
      categorie: ambient,
      fiche: { ...fiche, pochette: 'cover.jpg' },
      formulaire,
      pochette: { octets: new Uint8Array([9]), extension: '.webp' },
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.changements.find((c) => c.chemin.endsWith('cover.jpg'))).toEqual({
      chemin: 'public/musique/ambient/cover.jpg',
      supprimer: true,
    });
    expect(chemins(plan.changements)).toContain('public/musique/ambient/cover.webp');
    expect(contenu(plan.changements, 'categorie.json')).not.toHaveProperty('pochette');
  });

  it('crée la fiche d’une catégorie qui n’en avait pas', () => {
    const profond = cat('Deep House');
    const plan = planModificationCategorie({
      categorie: profond,
      fiche: undefined,
      formulaire: { nom: 'Deep House', description: '', couleur: '' },
    });
    expect(plan.ok && chemins(plan.changements)).toEqual([
      'public/musique/Deep House/categorie.json',
    ]);
  });

  it('refuse un nom vide ou une couleur sans contraste', () => {
    const plan = planModificationCategorie({
      categorie: ambient,
      fiche,
      formulaire: { nom: '', description: '', couleur: '#0b0b11' },
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) expect(plan.erreurs.map((e) => e.champ).sort()).toEqual(['contraste', 'nom']);
  });
});

describe('suppression d’une catégorie', () => {
  it('une catégorie vide perd seulement sa fiche', () => {
    const plan = planSuppressionCategorie({
      categorie: cat('vide'),
      fiche: { nom: 'Vide' },
      depot,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.message).toBe('suppression: catégorie « Vide »');
    expect(plan.changements).toEqual([
      { chemin: 'public/musique/vide/categorie.json', supprimer: true },
    ]);
  });

  it('une catégorie non vide exige une destination valide', () => {
    for (const destination of [undefined, 'ambient', 'inconnue']) {
      const plan = planSuppressionCategorie({
        categorie: cat('ambient'),
        fiche: undefined,
        ...(destination !== undefined && { destination }),
        depot,
      });
      expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'destination' }] });
    }
  });

  it('déplace titres et albums sans les renvoyer, puis retire fiche et pochette', () => {
    const plan = planSuppressionCategorie({
      categorie: cat('Deep House'),
      fiche: undefined,
      destination: 'vide',
      depot,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.message).toBe('suppression: catégorie « Deep House » (contenu déplacé vers vide)');
    expect(plan.changements).toEqual([
      { chemin: 'public/musique/vide/a.mp3', sha: 'sha:public/musique/Deep House/a.mp3' },
      { chemin: 'public/musique/Deep House/a.mp3', supprimer: true },
    ]);
  });

  it('déplace tout le contenu d’ambient vers vide, y compris l’album, et retire fiche et pochette', () => {
    const plan = planSuppressionCategorie({
      categorie: cat('ambient'),
      fiche: { nom: 'Ambient' },
      destination: 'vide',
      depot,
    });
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const reutilises = plan.changements.filter((c) => 'sha' in c).map((c) => c.chemin);
    expect(reutilises.sort()).toEqual([
      'public/musique/vide/Nuit/album.json',
      'public/musique/vide/Nuit/lune.mp3',
      'public/musique/vide/brume.json',
      'public/musique/vide/brume.mp3',
    ]);
    const supprimes = plan.changements.filter((c) => 'supprimer' in c).map((c) => c.chemin);
    expect(supprimes.sort()).toEqual(
      cat('ambient')
        .fichiers.map((f) => f.chemin)
        .sort(),
    );
  });

  it('refuse si un fichier ou un identifiant existe déjà à destination', () => {
    const plan = planSuppressionCategorie({
      categorie: cat('ambient'),
      fiche: undefined,
      destination: 'techno',
      depot,
    });
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.erreurs[0]?.champ).toBe('conflit');
      expect(plan.erreurs[0]?.chemins).toContain('public/musique/techno/Nuit/album.json');
    }
  });
});

describe('ordre des catégories', () => {
  const fiches = new Map<string, FicheBrute | undefined>([
    ['ambient', { nom: 'Ambient', ordre: 1 }],
    ['techno', undefined],
    ['Deep House', { description: 'x', ordre: 5 }],
  ]);

  it('n’écrit que les fiches dont l’ordre change, et crée celles qui manquent', () => {
    const ordre = [cat('ambient'), cat('Deep House'), cat('techno')];
    const plan = planOrdreCategories(ordre, fiches);
    expect(plan.message).toBe('modification: ordre des catégories');
    expect(chemins(plan.changements)).toEqual([
      'public/musique/Deep House/categorie.json',
      'public/musique/techno/categorie.json',
    ]);
    expect(contenu(plan.changements, 'Deep House/categorie.json')).toEqual({
      description: 'x',
      ordre: 2,
    });
    expect(contenu(plan.changements, 'techno/categorie.json')).toEqual({ ordre: 3 });
  });

  it('ne fait rien si l’ordre est déjà enregistré', () => {
    const deja = new Map<string, FicheBrute | undefined>([
      ['ambient', { ordre: 1 }],
      ['techno', { ordre: 2 }],
    ]);
    expect(planOrdreCategories([cat('ambient'), cat('techno')], deja).changements).toEqual([]);
  });
});
