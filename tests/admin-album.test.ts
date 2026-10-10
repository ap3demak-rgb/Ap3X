// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  formulaireAlbumVide,
  formulaireDepuisAlbum,
  fusionnerFicheAlbum,
  nomsDePistes,
  pistesDepuisAlbum,
  planAlbum,
  planSuppressionAlbum,
  type EntreeAlbum,
  type PisteAlbum,
} from '../src/admin/album';
import { analyserArbre, identifiantAlbumDepot, type AlbumDepot } from '../src/admin/depot';
import type { FicheBrute } from '../src/admin/edition';
import { anneesDesAlbums, filtrerAlbums, ligneAlbum } from '../src/admin/liste-albums';
import type { Changement, EntreeArbre } from '../src/admin/github';

const blob = (chemin: string): EntreeArbre => ({
  chemin,
  type: 'blob',
  sha: `sha:${chemin}`,
  taille: 1,
});

const depot = analyserArbre([
  blob('public/musique/ambient/solo.mp3'),
  blob('public/musique/ambient/solo.json'),
  blob('public/musique/ambient/solo.webp'),
  blob('public/musique/ambient/Nuit/album.json'),
  blob('public/musique/ambient/Nuit/cover.jpg'),
  blob('public/musique/ambient/Nuit/intro.mp3'),
  blob('public/musique/ambient/Nuit/intro.json'),
  blob('public/musique/ambient/Nuit/intro.webp'),
  blob('public/musique/ambient/Nuit/lune.mp3'),
  blob('public/musique/ambient/Nuit/aube.mp3'),
  blob('public/musique/ambient/Nuit/aube.json'),
  blob('public/musique/techno/vide.mp3'),
]);

const albumNuit = depot.albums[0] as AlbumDepot;
const FICHE_NUIT: FicheBrute = {
  titre: 'Nuit',
  artiste: 'AP3X Records',
  hashtags: ['calme'],
  pistes: ['intro.mp3', 'lune.mp3', { fichier: 'aube.mp3', disque: 2 }],
};
const FICHES_PISTES = new Map<string, FicheBrute | undefined>([
  ['public/musique/ambient/Nuit/intro.mp3', { titre: 'Intro', pochette: 'intro.webp' }],
  ['public/musique/ambient/Nuit/lune.mp3', undefined],
  ['public/musique/ambient/Nuit/aube.mp3', { titre: 'Aube', artiste: 'Invitée' }],
]);

const nouvelle = (cle: string, titre: string, octets = 10, disque = 1): PisteAlbum => ({
  cle,
  titre,
  artiste: '',
  disque,
  origine: { type: 'nouvelle', octets: new Uint8Array(octets) },
});

const chemins = (changements: Changement[]): string[] => changements.map((c) => c.chemin).sort();
const contenuDe = (changements: Changement[], fin: string): FicheBrute => {
  const c = changements.find((x) => x.chemin.endsWith(fin)) as { contenu: string } | undefined;
  return JSON.parse(c?.contenu ?? '{}') as FicheBrute;
};

describe('lecture d’un album existant', () => {
  it('trouve l’album dans l’arbre et ses fichiers', () => {
    expect(depot.albums).toHaveLength(1);
    expect(identifiantAlbumDepot(albumNuit)).toBe('ambient--nuit');
    expect(albumNuit.pistes.map((p) => p.base)).toEqual(['aube', 'intro', 'lune']);
    expect(albumNuit.images.map((i) => i.chemin)).toEqual([
      'public/musique/ambient/Nuit/cover.jpg',
      'public/musique/ambient/Nuit/intro.webp',
    ]);
  });

  it('reconstitue le formulaire et les pistes dans l’ordre de album.json, avec disques', () => {
    expect(formulaireDepuisAlbum(albumNuit, FICHE_NUIT)).toMatchObject({
      titre: 'Nuit',
      artiste: 'AP3X Records',
      categorie: 'ambient',
      hashtags: '#calme',
      type: '',
      visible: true,
    });
    const pistes = pistesDepuisAlbum(albumNuit, FICHE_NUIT, FICHES_PISTES);
    expect(pistes.map((p) => [p.titre, p.disque, p.artiste])).toEqual([
      ['Intro', 1, ''],
      ['lune', 1, ''],
      ['Aube', 2, 'Invitée'],
    ]);
  });
});

describe('noms de fichier des pistes', () => {
  it('garde les noms du dépôt et rend uniques ceux qui dérivent du titre', () => {
    const pistes = [
      nouvelle('a', 'Intro'),
      nouvelle('b', 'Intro'),
      nouvelle('c', 'Été !'),
      nouvelle('d', '???'),
    ];
    expect([...nomsDePistes(pistes).values()]).toEqual(['intro', 'intro-2', 'ete', 'piste']);
    const existantes = pistesDepuisAlbum(albumNuit, FICHE_NUIT, FICHES_PISTES);
    const melange = [...existantes, nouvelle('n', 'Intro')];
    expect(nomsDePistes(melange).get('n')).toBe('intro-2');
  });
});

describe('fiche d’album', () => {
  it('écrit les pistes (chaîne pour le disque 1, objet sinon) et omet les valeurs par défaut', () => {
    const pistes = pistesDepuisAlbum(albumNuit, FICHE_NUIT, FICHES_PISTES);
    const fiche = fusionnerFicheAlbum(
      FICHE_NUIT,
      formulaireDepuisAlbum(albumNuit, FICHE_NUIT),
      pistes,
      nomsDePistes(pistes),
      { visible: true },
    );
    expect(fiche).toEqual(FICHE_NUIT);
  });

  it('écrit le type seulement s’il est choisi, et visible: false pour un brouillon', () => {
    const pistes = [nouvelle('a', 'A')];
    const base = { ...formulaireAlbumVide('x'), titre: 'T' };
    const auto = fusionnerFicheAlbum(undefined, base, pistes, nomsDePistes(pistes), {
      visible: true,
    });
    expect(auto).not.toHaveProperty('type');
    const choisi = fusionnerFicheAlbum(
      undefined,
      { ...base, type: 'compilation', visible: false },
      pistes,
      nomsDePistes(pistes),
      { visible: false },
    );
    expect(choisi).toMatchObject({ type: 'compilation', visible: false });
  });
});

describe('création d’un album', () => {
  const entree = (surcharge: Partial<EntreeAlbum> = {}): EntreeAlbum => ({
    formulaire: { ...formulaireAlbumVide('ambient'), titre: 'Été Indien', artiste: 'Zoé' },
    pistes: [nouvelle('a', 'Premier'), nouvelle('b', 'Second', 10, 2)],
    pochette: { octets: new Uint8Array([1]), extension: '.webp' },
    depot,
    ...surcharge,
  });

  it('publie tout en un seul commit : album.json, fiches de pistes, MP3 et pochette', () => {
    const plan = planAlbum(
      entree({ pochette: { octets: new Uint8Array([1, 2]), extension: '.webp' } }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.id).toBe('ambient--ete-indien');
    expect(plan.lots).toHaveLength(1);
    const lot = plan.lots[0];
    expect(lot?.message).toBe('ajout: album « Été Indien »');
    const dossier = 'public/musique/ambient/ete-indien';
    expect(chemins(lot?.changements ?? [])).toEqual([
      `${dossier}/album.json`,
      `${dossier}/cover.webp`,
      `${dossier}/premier.json`,
      `${dossier}/premier.mp3`,
      `${dossier}/second.json`,
      `${dossier}/second.mp3`,
    ]);
    expect(contenuDe(lot?.changements ?? [], 'album.json')).toEqual({
      titre: 'Été Indien',
      artiste: 'Zoé',
      pistes: ['premier.mp3', { fichier: 'second.mp3', disque: 2 }],
    });
    expect(contenuDe(lot?.changements ?? [], 'premier.json')).toEqual({ titre: 'Premier' });
  });

  it('un brouillon est annoncé comme tel et masqué', () => {
    const plan = planAlbum(entree({ formulaire: { ...entree().formulaire, visible: false } }));
    expect(plan.ok && plan.lots[0]?.message).toBe("ajout: brouillon d'album « Été Indien »");
    if (plan.ok) {
      expect(contenuDe(plan.lots[0]?.changements ?? [], 'album.json')['visible']).toBe(false);
    }
  });

  it('exige une pochette pour publier, pas pour un brouillon', () => {
    const sans = planAlbum(entree({ pochette: undefined }));
    expect(sans).toEqual({ ok: false, erreurs: [{ champ: 'pochette' }] });
    const brouillon = planAlbum(
      entree({ pochette: undefined, formulaire: { ...entree().formulaire, visible: false } }),
    );
    expect(brouillon.ok).toBe(true);
  });

  it('valide titre, catégorie, date, pistes, titres de pistes et disques', () => {
    const plan = planAlbum(
      entree({
        formulaire: { ...entree().formulaire, titre: ' ', categorie: ' ', date: '2024-5' },
        pistes: [nouvelle('a', ' '), nouvelle('b', 'B', 10, 0)],
      }),
    );
    expect(plan.ok).toBe(false);
    if (!plan.ok) {
      expect(plan.erreurs.map((e) => e.champ).sort()).toEqual([
        'categorie',
        'date',
        'disque',
        'titre',
        'titre_piste',
      ]);
      expect(plan.erreurs.find((e) => e.champ === 'titre_piste')?.cles).toEqual(['a']);
    }
    const vide = planAlbum(entree({ pistes: [] }));
    expect(vide).toEqual({ ok: false, erreurs: [{ champ: 'pistes' }] });
  });

  it('refuse un album dont l’identifiant ou le dossier existe déjà', () => {
    const plan = planAlbum(entree({ formulaire: { ...entree().formulaire, titre: 'NUIT' } }));
    expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'doublon', id: 'ambient--nuit' }] });
  });

  it('découpe un gros envoi : structure et album masqué, MP3 par paquets, puis album visible', () => {
    const plan = planAlbum(
      entree({
        pistes: [nouvelle('a', 'A', 30), nouvelle('b', 'B', 30), nouvelle('c', 'C', 30)],
        seuilLot: 50,
      }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lots.map((l) => l.message)).toEqual([
      'ajout: album « Été Indien » [1/5]',
      'ajout: album « Été Indien » [2/5]',
      'ajout: album « Été Indien » [3/5]',
      'ajout: album « Été Indien » [4/5]',
      'ajout: album « Été Indien » [5/5]',
    ]);
    const [premier, ...suite] = plan.lots;
    expect(contenuDe(premier?.changements ?? [], 'album.json')['visible']).toBe(false);
    expect(chemins(premier?.changements ?? []).some((c) => c.endsWith('.mp3'))).toBe(false);
    // Chaque paquet reste sous le seuil (un fichier plus gros qu’un paquet part seul).
    for (const lot of suite.slice(0, -1)) {
      const taille = lot.changements.reduce(
        (somme, c) => somme + ('contenu' in c ? c.contenu.length : 0),
        0,
      );
      expect(taille).toBeLessThanOrEqual(50);
      expect(lot.changements.every((c) => c.chemin.endsWith('.mp3'))).toBe(true);
    }
    const dernier = plan.lots.at(-1);
    expect(dernier?.changements).toHaveLength(1);
    expect(contenuDe(dernier?.changements ?? [], 'album.json')).not.toHaveProperty('visible');
    // Tous les MP3 sont envoyés exactement une fois.
    const mp3 = plan.lots.flatMap((l) => l.changements.filter((c) => c.chemin.endsWith('.mp3')));
    expect(mp3).toHaveLength(3);
  });

  it('un brouillon volumineux reste masqué : pas de dernier commit de publication', () => {
    const plan = planAlbum(
      entree({
        formulaire: { ...entree().formulaire, visible: false },
        pistes: [nouvelle('a', 'A', 30), nouvelle('b', 'B', 30)],
        seuilLot: 40,
      }),
    );
    expect(plan.ok && plan.lots).toHaveLength(3);
    if (plan.ok) {
      for (const lot of plan.lots) {
        const album = lot.changements.find((c) => c.chemin.endsWith('album.json'));
        if (album !== undefined) {
          expect(JSON.parse((album as { contenu: string }).contenu).visible).toBe(false);
        }
      }
    }
  });
});

describe('modification d’un album', () => {
  const existant = { album: albumNuit, fiche: FICHE_NUIT, fichesPistes: FICHES_PISTES };
  const entree = (surcharge: Partial<EntreeAlbum> = {}): EntreeAlbum => ({
    formulaire: formulaireDepuisAlbum(albumNuit, FICHE_NUIT),
    pistes: pistesDepuisAlbum(albumNuit, FICHE_NUIT, FICHES_PISTES),
    existant,
    depot,
    ...surcharge,
  });

  it('ne fait rien quand rien n’a changé', () => {
    expect(planAlbum(entree())).toMatchObject({ ok: true, lots: [] });
  });

  it('réordonner ne touche que album.json', () => {
    const [intro, lune, aube] = entree().pistes;
    const plan = planAlbum(
      entree({ pistes: [lune as PisteAlbum, intro as PisteAlbum, aube as PisteAlbum] }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lots[0]?.message).toBe('modification: album « Nuit »');
    expect(chemins(plan.lots[0]?.changements ?? [])).toEqual([
      'public/musique/ambient/Nuit/album.json',
    ]);
    expect(contenuDe(plan.lots[0]?.changements ?? [], 'album.json')['pistes']).toEqual([
      'lune.mp3',
      'intro.mp3',
      { fichier: 'aube.mp3', disque: 2 },
    ]);
  });

  it('renommer une piste ou changer son artiste ne modifie que sa fiche', () => {
    const pistes = entree().pistes.map((p) =>
      p.titre === 'lune' ? { ...p, titre: 'Lune rousse', artiste: 'Invité' } : p,
    );
    const plan = planAlbum(entree({ pistes }));
    expect(plan.ok && chemins(plan.lots[0]?.changements ?? [])).toEqual([
      'public/musique/ambient/Nuit/lune.json',
    ]);
    if (plan.ok) {
      expect(contenuDe(plan.lots[0]?.changements ?? [], 'lune.json')).toEqual({
        titre: 'Lune rousse',
        artiste: 'Invité',
      });
    }
  });

  it('ajoute une nouvelle piste à la fin : fiche, MP3 et liste', () => {
    const plan = planAlbum(entree({ pistes: [...entree().pistes, nouvelle('n', 'Nocturne', 5)] }));
    expect(plan.ok && chemins(plan.lots[0]?.changements ?? [])).toEqual([
      'public/musique/ambient/Nuit/album.json',
      'public/musique/ambient/Nuit/nocturne.json',
      'public/musique/ambient/Nuit/nocturne.mp3',
    ]);
  });

  it('retirer une piste la renvoie dans la catégorie comme titre seul, avec la pochette de l’album', () => {
    const pistes = entree().pistes.filter((p) => p.titre !== 'lune');
    const plan = planAlbum(entree({ pistes }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const c = plan.lots[0]?.changements ?? [];
    expect(c.filter((x) => 'sha' in x)).toEqual([
      {
        chemin: 'public/musique/ambient/lune.mp3',
        sha: 'sha:public/musique/ambient/Nuit/lune.mp3',
      },
      {
        chemin: 'public/musique/ambient/lune.jpg',
        sha: 'sha:public/musique/ambient/Nuit/cover.jpg',
      },
    ]);
    expect(c.filter((x) => 'supprimer' in x).map((x) => x.chemin)).toEqual([
      'public/musique/ambient/Nuit/lune.mp3',
    ]);
    expect(contenuDe(c, 'ambient/lune.json')).toEqual({ pochette: 'lune.jpg' });
    expect(contenuDe(c, 'Nuit/album.json')['pistes']).toEqual([
      'intro.mp3',
      { fichier: 'aube.mp3', disque: 2 },
    ]);
  });

  it('une piste retirée garde sa propre image et sa fiche', () => {
    const pistes = entree().pistes.filter((p) => p.titre !== 'Intro');
    const plan = planAlbum(entree({ pistes }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const c = plan.lots[0]?.changements ?? [];
    expect(c.filter((x) => 'sha' in x).map((x) => x.chemin)).toEqual([
      'public/musique/ambient/intro.mp3',
      'public/musique/ambient/intro.webp',
    ]);
    expect(contenuDe(c, 'ambient/intro.json')).toEqual({
      titre: 'Intro',
      pochette: 'intro.webp',
    });
  });

  it('refuse de retirer une piste dont le nom est déjà pris dans la catégorie', () => {
    const avecSolo = analyserArbre([
      blob('public/musique/ambient/lune.mp3'),
      blob('public/musique/ambient/Nuit/cover.jpg'),
      blob('public/musique/ambient/Nuit/album.json'),
      blob('public/musique/ambient/Nuit/lune.mp3'),
      blob('public/musique/ambient/Nuit/intro.mp3'),
    ]);
    const album = avecSolo.albums[0] as AlbumDepot;
    const fiche = { titre: 'Nuit', pistes: ['intro.mp3', 'lune.mp3'] };
    const fiches = new Map<string, FicheBrute | undefined>();
    const pistes = pistesDepuisAlbum(album, fiche, fiches).filter((p) => p.titre !== 'lune');
    const plan = planAlbum({
      formulaire: formulaireDepuisAlbum(album, fiche),
      pistes,
      existant: { album, fiche, fichesPistes: fiches },
      depot: avecSolo,
    });
    expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'retrait', id: 'ambient--lune' }] });
  });

  it('rattache un titre seul à l’album : ses fichiers sont déplacés sans être renvoyés', () => {
    const solo = depot.pistes.find((p) => p.base === 'solo');
    if (solo === undefined) throw new Error('solo absent');
    const ajout: PisteAlbum = {
      cle: 'solo',
      titre: 'Solo',
      artiste: '',
      disque: 1,
      origine: { type: 'publiee', piste: solo, fiche: { titre: 'Solo', pochette: 'solo.webp' } },
    };
    const plan = planAlbum(entree({ pistes: [...entree().pistes, ajout] }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const c = plan.lots[0]?.changements ?? [];
    expect(c.filter((x) => 'sha' in x).map((x) => x.chemin)).toEqual([
      'public/musique/ambient/Nuit/solo.mp3',
      'public/musique/ambient/Nuit/solo.webp',
    ]);
    expect(
      c
        .filter((x) => 'supprimer' in x)
        .map((x) => x.chemin)
        .sort(),
    ).toEqual([
      'public/musique/ambient/solo.json',
      'public/musique/ambient/solo.mp3',
      'public/musique/ambient/solo.webp',
    ]);
    expect(contenuDe(c, 'Nuit/solo.json')).toEqual({ titre: 'Solo', pochette: 'solo.webp' });
  });

  it('remplace la pochette : cover.<ext> écrite, ancienne supprimée, déclaration retirée', () => {
    const plan = planAlbum(
      entree({ pochette: { octets: new Uint8Array([7]), extension: '.webp' } }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    const c = plan.lots[0]?.changements ?? [];
    expect(chemins(c)).toEqual([
      'public/musique/ambient/Nuit/cover.jpg',
      'public/musique/ambient/Nuit/cover.webp',
    ]);
    expect(c.find((x) => x.chemin.endsWith('cover.jpg'))).toEqual({
      chemin: 'public/musique/ambient/Nuit/cover.jpg',
      supprimer: true,
    });
  });

  it('déplace tout l’album dans une autre catégorie sans rien renvoyer', () => {
    const plan = planAlbum(entree({ formulaire: { ...entree().formulaire, categorie: 'techno' } }));
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lots[0]?.message).toBe('déplacement: album « Nuit » vers techno');
    const c = plan.lots[0]?.changements ?? [];
    const suppressions = c
      .filter((x) => 'supprimer' in x)
      .map((x) => x.chemin)
      .sort();
    expect(suppressions).toEqual(albumNuit.fichiers.map((f) => f.chemin).sort());
    const reutilises = c.filter((x) => 'sha' in x).map((x) => x.chemin);
    expect(reutilises).toContain('public/musique/techno/Nuit/lune.mp3');
    expect(reutilises).toContain('public/musique/techno/Nuit/cover.jpg');
    expect(reutilises).toContain('public/musique/techno/Nuit/intro.webp');
    expect(c.some((x) => x.chemin === 'public/musique/techno/Nuit/album.json')).toBe(true);
    // Seuls des JSON sont écrits : aucun MP3 ni image n'est renvoyé.
    expect(c.filter((x) => 'contenu' in x).every((x) => x.chemin.endsWith('.json'))).toBe(true);
  });

  it('refuse de déplacer l’album vers un dossier qui contient déjà un album de même nom', () => {
    const avecDoublon = analyserArbre([
      ...[...depot.chemins].map(blob),
      blob('public/musique/techno/Nuit/album.json'),
      blob('public/musique/techno/Nuit/x.mp3'),
    ]);
    const plan = planAlbum(
      entree({
        formulaire: { ...entree().formulaire, categorie: 'techno' },
        depot: avecDoublon,
      }),
    );
    expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'doublon', id: 'techno--nuit' }] });
  });

  it('masquer ou publier se voit dans le message', () => {
    const masque = planAlbum(entree({ formulaire: { ...entree().formulaire, visible: false } }));
    expect(masque.ok && masque.lots[0]?.message).toBe('masquage: album « Nuit »');
    const cache = { ...FICHE_NUIT, visible: false };
    const publie = planAlbum(entree({ existant: { ...existant, fiche: cache } }));
    expect(publie.ok && publie.lots[0]?.message).toBe('publication: album « Nuit »');
  });

  it('un gros ajout masque l’album le temps de l’envoi puis le republie', () => {
    const plan = planAlbum(
      entree({
        pistes: [...entree().pistes, nouvelle('n', 'Long', 100)],
        seuilLot: 60,
      }),
    );
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.lots).toHaveLength(3);
    expect(contenuDe(plan.lots[0]?.changements ?? [], 'album.json')['visible']).toBe(false);
    expect(plan.lots[1]?.changements.map((c) => c.chemin)).toEqual([
      'public/musique/ambient/Nuit/long.mp3',
    ]);
    expect(contenuDe(plan.lots[2]?.changements ?? [], 'album.json')).not.toHaveProperty('visible');
  });
});

describe('suppression d’un album', () => {
  it('« tout » retire chaque fichier du dossier', () => {
    const plan = planSuppressionAlbum(albumNuit, FICHE_NUIT, FICHES_PISTES, 'tout', depot);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.message).toBe('suppression: album « Nuit » et ses pistes');
    expect(plan.changements.every((c) => 'supprimer' in c)).toBe(true);
    expect(chemins(plan.changements)).toEqual(albumNuit.fichiers.map((f) => f.chemin).sort());
  });

  it('« conserver » transforme les pistes en titres seuls puis retire le reste', () => {
    const libre = analyserArbre(
      [...depot.chemins]
        .filter(
          (c) => !c.endsWith('/solo.mp3') && !c.endsWith('/solo.json') && !c.endsWith('/solo.webp'),
        )
        .map(blob),
    );
    const album = libre.albums[0] as AlbumDepot;
    const plan = planSuppressionAlbum(album, FICHE_NUIT, FICHES_PISTES, 'conserver', libre);
    expect(plan.ok).toBe(true);
    if (!plan.ok) return;
    expect(plan.message).toBe('suppression: album « Nuit » (pistes conservées)');
    const reutilises = plan.changements.filter((c) => 'sha' in c).map((c) => c.chemin);
    expect(reutilises).toEqual(
      expect.arrayContaining([
        'public/musique/ambient/intro.mp3',
        'public/musique/ambient/lune.mp3',
        'public/musique/ambient/aube.mp3',
        'public/musique/ambient/lune.jpg',
        'public/musique/ambient/aube.jpg',
        'public/musique/ambient/intro.webp',
      ]),
    );
    // Rien ne reste dans le dossier de l’album, et chaque fichier n’est supprimé qu’une fois.
    const supprimes = plan.changements.filter((c) => 'supprimer' in c).map((c) => c.chemin);
    expect(new Set(supprimes).size).toBe(supprimes.length);
    expect([...supprimes].sort()).toEqual(album.fichiers.map((f) => f.chemin).sort());
  });

  it('« conserver » est refusé si un titre seul porte déjà le même nom', () => {
    const plan = planSuppressionAlbum(
      albumNuit,
      FICHE_NUIT,
      FICHES_PISTES,
      'conserver',
      analyserArbre([...depot.chemins, 'public/musique/ambient/lune.mp3'].map(blob)),
    );
    expect(plan).toEqual({ ok: false, erreurs: [{ champ: 'retrait', id: 'ambient--lune' }] });
  });
});

describe('liste des albums', () => {
  const lignes = [
    ligneAlbum(albumNuit, FICHE_NUIT),
    ligneAlbum(
      { ...albumNuit, categorie: 'techno', dossier: 'Zénith', pistes: [] },
      { titre: 'Zénith', type: 'compilation', date: '2023-05', pistes: ['a.mp3'], visible: false },
    ),
    ligneAlbum({ ...albumNuit, categorie: 'techno', dossier: 'Casse', pistes: [] }, undefined),
  ];

  it('résume un album : type déduit, nombre de pistes, complet ou non', () => {
    expect(lignes[0]).toMatchObject({
      id: 'ambient--nuit',
      titre: 'Nuit',
      type: 'ep',
      nombrePistes: 3,
      visible: true,
      incomplet: false,
      illisible: false,
    });
  });

  it('signale un album incomplet, masqué ou illisible', () => {
    expect(lignes[1]).toMatchObject({
      type: 'compilation',
      annee: '2023',
      visible: false,
      incomplet: true,
    });
    expect(lignes[2]).toMatchObject({ illisible: true, titre: 'Casse', nombrePistes: 0 });
  });

  it('liste les années, filtre et trie', () => {
    expect(anneesDesAlbums(lignes)).toEqual(['2023']);
    const criteres = { recherche: '', type: '' as const, categorie: '', annee: '' };
    expect(filtrerAlbums(lignes, criteres).map((l) => l.titre)).toEqual([
      'Casse',
      'Nuit',
      'Zénith',
    ]);
    expect(filtrerAlbums(lignes, { ...criteres, type: 'ep' }).map((l) => l.titre)).toEqual([
      'Nuit',
    ]);
    expect(filtrerAlbums(lignes, { ...criteres, categorie: 'techno' }).map((l) => l.titre)).toEqual(
      ['Casse', 'Zénith'],
    );
    expect(filtrerAlbums(lignes, { ...criteres, annee: '2023' }).map((l) => l.titre)).toEqual([
      'Zénith',
    ]);
    expect(filtrerAlbums(lignes, { ...criteres, recherche: 'zenith' }).map((l) => l.titre)).toEqual(
      ['Zénith'],
    );
  });
});
