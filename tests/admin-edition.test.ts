// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { analyserArbre, type PisteDepot } from '../src/admin/depot';
import {
  formulaireDepuisFiche,
  fusionnerFiche,
  lireFicheBrute,
  planGroupe,
  planModification,
  planSuppression,
  serialiserFiche,
  type FicheBrute,
} from '../src/admin/edition';
import type { Changement, EntreeArbre } from '../src/admin/github';
import { lignePiste } from '../src/admin/liste';

const blob = (chemin: string): EntreeArbre => ({
  chemin,
  type: 'blob',
  sha: `sha:${chemin}`,
  taille: 1,
});

const depot = analyserArbre([
  blob('public/musique/ambient/brume.mp3'),
  blob('public/musique/ambient/brume.json'),
  blob('public/musique/ambient/brume.webp'),
  blob('public/musique/techno/300.mp3'),
  blob('public/musique/techno/300.json'),
  blob('public/musique/techno/seul.mp3'),
  blob('public/musique/techno/brume.mp3'),
  blob('public/musique/techno/club/01-intro.mp3'),
  blob('public/musique/techno/club/01-intro.json'),
  blob('public/musique/techno/club/album.json'),
  blob('public/musique/techno/partagee.mp3'),
  blob('public/musique/techno/partagee.json'),
  blob('public/musique/techno/cover.jpg'),
]);

const piste = (base: string, album?: string, categorie?: string): PisteDepot => {
  const trouvee = depot.pistes.find(
    (p) =>
      p.base === base &&
      p.album === album &&
      (categorie === undefined || p.categorie === categorie),
  );
  if (trouvee === undefined) throw new Error(`piste absente : ${base}`);
  return trouvee;
};

const FICHE_BRUME: FicheBrute = {
  titre: 'Brume',
  hashtags: ['nuit'],
  pochette: 'brume.webp',
  categories: ['techno'],
  visible: false,
};

const chemins = (changements: Changement[]): string[] => changements.map((c) => c.chemin).sort();
const suppressions = (changements: Changement[]): string[] =>
  chemins(changements.filter((c) => 'supprimer' in c));

describe('fiche brute', () => {
  it('lit un objet JSON et refuse le reste', () => {
    expect(lireFicheBrute('{"titre":"A"}')).toEqual({ titre: 'A' });
    expect(() => lireFicheBrute('[1]')).toThrow();
    expect(() => lireFicheBrute('nul')).toThrow();
  });

  it('remplit le formulaire d’après la fiche, avec des valeurs neutres si elle manque', () => {
    expect(formulaireDepuisFiche(piste('brume', undefined), FICHE_BRUME)).toMatchObject({
      titre: 'Brume',
      artiste: '',
      categorie: 'ambient',
      hashtags: '#nuit',
      visible: false,
      telechargement: false,
      licence: 'CC BY-NC-ND 4.0',
    });
    expect(formulaireDepuisFiche(piste('seul'), undefined)).toMatchObject({
      titre: 'seul',
      visible: true,
    });
  });

  it('fusionne en gardant les champs inconnus du formulaire et en retirant les valeurs par défaut', () => {
    const formulaire = {
      ...formulaireDepuisFiche(piste('brume'), FICHE_BRUME),
      visible: true,
      hashtags: '#nuit #calme',
      licence: 'CC BY-NC-ND 4.0',
    };
    const fusion = fusionnerFiche(FICHE_BRUME, formulaire);
    expect(fusion).toEqual({
      titre: 'Brume',
      hashtags: ['nuit', 'calme'],
      pochette: 'brume.webp',
      categories: ['techno'],
    });
    expect(serialiserFiche(fusion).endsWith('\n')).toBe(true);
  });

  it('refuse de sérialiser une fiche invalide', () => {
    expect(() => serialiserFiche({ titre: 'A', date: 'hier' })).toThrow();
    expect(() => serialiserFiche({ titre: 'A', inconnu: 1 })).toThrow();
  });
});

describe('modification d’une piste', () => {
  const brume = piste('brume', undefined);
  const base = (surcharge = {}) => ({
    ...formulaireDepuisFiche(brume, FICHE_BRUME),
    ...surcharge,
  });

  it('n’enregistre rien quand rien n’a changé', () => {
    const plan = planModification({ piste: brume, fiche: FICHE_BRUME, formulaire: base() }, depot);
    expect(plan).toEqual({ ok: true, changements: [], message: '' });
  });

  it('met à jour seulement la fiche pour un changement de titre ou de hashtags', () => {
    const plan = planModification(
      { piste: brume, fiche: FICHE_BRUME, formulaire: base({ titre: 'Brume du matin' }) },
      depot,
    );
    expect(plan).toMatchObject({ ok: true, message: 'modification: piste « Brume du matin »' });
    if (plan.ok) {
      expect(chemins(plan.changements)).toEqual(['public/musique/ambient/brume.json']);
    }
  });

  it('publie un brouillon et masque une piste visible, avec un message adapté', () => {
    const publier = planModification(
      { piste: brume, fiche: FICHE_BRUME, formulaire: base({ visible: true }) },
      depot,
    );
    expect(publier).toMatchObject({ ok: true, message: 'publication: piste « Brume »' });
    if (publier.ok) {
      const contenu = (publier.changements[0] as { contenu: string }).contenu;
      expect(JSON.parse(contenu)).not.toHaveProperty('visible');
    }
    const trois = piste('300');
    const masquer = planModification(
      {
        piste: trois,
        fiche: { titre: 'Trois' },
        formulaire: { ...formulaireDepuisFiche(trois, { titre: 'Trois' }), visible: false },
      },
      depot,
    );
    expect(masquer).toMatchObject({ ok: true, message: 'masquage: piste « Trois »' });
  });

  it('remplace le MP3 sur place, sans toucher à la fiche inchangée', () => {
    const plan = planModification(
      {
        piste: brume,
        fiche: FICHE_BRUME,
        formulaire: base(),
        nouveauMp3: new Uint8Array([1, 2, 3]),
      },
      depot,
    );
    expect(plan.ok && chemins(plan.changements)).toEqual(['public/musique/ambient/brume.mp3']);
  });

  it('remplace la pochette : nouvelle image, ancienne retirée si le format change, fiche mise à jour', () => {
    const plan = planModification(
      {
        piste: brume,
        fiche: FICHE_BRUME,
        formulaire: base(),
        pochette: { octets: new Uint8Array([9]), extension: '.jpg' },
      },
      depot,
    );
    expect(plan.ok).toBe(true);
    if (plan.ok) {
      expect(chemins(plan.changements)).toEqual([
        'public/musique/ambient/brume.jpg',
        'public/musique/ambient/brume.json',
        'public/musique/ambient/brume.webp',
      ]);
      expect(suppressions(plan.changements)).toEqual(['public/musique/ambient/brume.webp']);
      const fiche = plan.changements.find((c) => c.chemin.endsWith('.json')) as { contenu: string };
      expect(JSON.parse(fiche.contenu).pochette).toBe('brume.jpg');
    }
  });

  it('écrase simplement l’image quand le format est le même', () => {
    const plan = planModification(
      {
        piste: brume,
        fiche: FICHE_BRUME,
        formulaire: base(),
        pochette: { octets: new Uint8Array([9]), extension: '.webp' },
      },
      depot,
    );
    expect(plan.ok && suppressions(plan.changements)).toEqual([]);
  });

  it('déplace dans une autre catégorie en réutilisant le MP3 et l’image sans les renvoyer', () => {
    const plan = planModification(
      { piste: brume, fiche: FICHE_BRUME, formulaire: base({ categorie: 'drone' }) },
      depot,
    );
    expect(plan).toMatchObject({
      ok: true,
      message: 'déplacement: piste « Brume » vers drone',
    });
    if (!plan.ok) return;
    expect(suppressions(plan.changements)).toEqual([
      'public/musique/ambient/brume.json',
      'public/musique/ambient/brume.mp3',
      'public/musique/ambient/brume.webp',
    ]);
    expect(plan.changements.filter((c) => 'sha' in c)).toEqual([
      { chemin: 'public/musique/drone/brume.mp3', sha: 'sha:public/musique/ambient/brume.mp3' },
      { chemin: 'public/musique/drone/brume.webp', sha: 'sha:public/musique/ambient/brume.webp' },
    ]);
    expect(plan.changements.some((c) => c.chemin === 'public/musique/drone/brume.json')).toBe(true);
  });

  it('refuse un déplacement qui créerait un doublon d’identifiant', () => {
    const plan = planModification(
      { piste: brume, fiche: FICHE_BRUME, formulaire: base({ categorie: 'techno' }) },
      depot,
    );
    expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'doublon', id: 'techno--brume' }] });
  });

  it('refuse de déplacer une piste d’album, et une piste dont la fiche pointe vers une image partagée', () => {
    const intro = piste('01-intro', 'club');
    const album = planModification(
      {
        piste: intro,
        fiche: { titre: 'Intro' },
        formulaire: { ...formulaireDepuisFiche(intro, { titre: 'Intro' }), categorie: 'ambient' },
      },
      depot,
    );
    expect(album).toEqual({ ok: false, erreurs: [{ champ: 'album' }] });

    const partagee = piste('partagee');
    const fiche = { titre: 'Partagée', pochette: 'cover.jpg' };
    const lien = planModification(
      {
        piste: partagee,
        fiche,
        formulaire: { ...formulaireDepuisFiche(partagee, fiche), categorie: 'ambient' },
      },
      depot,
    );
    expect(lien).toEqual({ ok: false, erreurs: [{ champ: 'deplacement' }] });
  });

  it('modifie sur place une piste d’album, dans le dossier de l’album', () => {
    const intro = piste('01-intro', 'club');
    const plan = planModification(
      {
        piste: intro,
        fiche: { titre: 'Intro' },
        formulaire: { ...formulaireDepuisFiche(intro, { titre: 'Intro' }), titre: 'Intro longue' },
      },
      depot,
    );
    expect(plan.ok && chemins(plan.changements)).toEqual([
      'public/musique/techno/club/01-intro.json',
    ]);
  });

  it('crée la fiche d’une piste qui n’en avait pas', () => {
    const seul = piste('seul');
    const plan = planModification(
      {
        piste: seul,
        fiche: undefined,
        formulaire: { ...formulaireDepuisFiche(seul, undefined), hashtags: '#nouveau' },
      },
      depot,
    );
    expect(plan.ok && chemins(plan.changements)).toEqual(['public/musique/techno/seul.json']);
  });

  it('valide titre, catégorie et date', () => {
    const plan = planModification(
      {
        piste: brume,
        fiche: FICHE_BRUME,
        formulaire: base({ titre: ' ', categorie: ' ', date: '2024-5' }),
      },
      depot,
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok)
      expect(plan.erreurs.map((e) => e.champ).sort()).toEqual(['categorie', 'date', 'titre']);
  });
});

describe('suppression', () => {
  const ligne = (base: string, album?: string) =>
    lignePiste(piste(base, album), { titre: base.toUpperCase(), hashtags: [], visible: true });

  it('retire le MP3, la fiche et l’image du même nom, et rien d’autre', () => {
    const plan = planSuppression([ligne('brume', undefined)].map((l) => l));
    expect(chemins(plan.changements)).toEqual([
      'public/musique/ambient/brume.json',
      'public/musique/ambient/brume.mp3',
      'public/musique/ambient/brume.webp',
    ]);
    expect(plan.message).toBe('suppression: piste « BRUME »');
    expect(plan.changements.every((c) => 'supprimer' in c)).toBe(true);
  });

  it('ignore les pistes d’album et résume le lot', () => {
    const plan = planSuppression([ligne('300'), ligne('seul'), ligne('01-intro', 'club')]);
    expect(plan.ignorees.map((l) => l.piste.base)).toEqual(['01-intro']);
    expect(plan.message).toBe('suppression: 2 pistes');
    expect(chemins(plan.changements)).not.toContain('public/musique/techno/club/01-intro.mp3');
  });
});

describe('actions groupées', () => {
  const lignes = ['300', 'seul'].map((b) =>
    lignePiste(piste(b), { titre: b, hashtags: [], visible: true }),
  );
  const fiches = new Map<string, FicheBrute | undefined>([
    ['public/musique/techno/300.mp3', { titre: 'Trois Cents', hashtags: ['nuit'] }],
    ['public/musique/techno/seul.mp3', undefined],
  ]);

  it('ajoute un hashtag à chaque piste sans doublon et ignore celles déjà à jour', () => {
    const lot = planGroupe(lignes, fiches, { type: 'hashtag', hashtag: 'nuit' }, depot);
    expect(lot.modifiees).toBe(1);
    expect(chemins(lot.changements)).toEqual(['public/musique/techno/seul.json']);
    const contenu = (lot.changements[0] as { contenu: string }).contenu;
    expect(JSON.parse(contenu).hashtags).toEqual(['nuit']);
    expect(lot.message).toBe('modification: 1 pistes (ajout du hashtag #nuit)');
  });

  it('masque ou publie plusieurs pistes', () => {
    const lot = planGroupe(lignes, fiches, { type: 'visibilite', visible: false }, depot);
    expect(lot.modifiees).toBe(2);
    expect(lot.message).toContain('masquage');
    const deja = planGroupe(lignes, fiches, { type: 'visibilite', visible: true }, depot);
    expect(deja.modifiees).toBe(0);
    expect(deja.changements).toEqual([]);
  });

  it('déplace plusieurs pistes en un lot', () => {
    const lot = planGroupe(lignes, fiches, { type: 'categorie', dossier: 'ambient' }, depot);
    expect(lot.modifiees).toBe(2);
    expect(lot.message).toBe('modification: 2 pistes (déplacement vers ambient)');
    expect(lot.refusees).toEqual([]);
  });

  it('refuse un déplacement vers un dossier qui contient déjà un identifiant identique', () => {
    const brumeTechno = lignePiste(piste('brume', undefined, 'techno'), {
      titre: 'Brume',
      hashtags: [],
      visible: true,
    });
    const lot = planGroupe(
      [brumeTechno],
      new Map(),
      { type: 'categorie', dossier: 'ambient' },
      depot,
    );
    expect(lot.modifiees).toBe(0);
    expect(lot.refusees[0]?.erreurs).toEqual([{ champ: 'doublon', id: 'ambient--brume' }]);
  });
});
