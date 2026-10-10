// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync } from 'node:fs';
import { mkdir, mkdtemp, readdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import NodeID3 from 'node-id3';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { construireCatalogue } from '../scripts/catalogue/construire';
import { construireFiche, formulaireVide, nomFichierPiste } from '../src/admin/fiche';

let racine: string;
let musique: string;
let pochettes: string;

beforeEach(async () => {
  racine = await mkdtemp(join(tmpdir(), 'ap3x-catalogue-'));
  musique = join(racine, 'musique');
  pochettes = join(racine, 'pochettes');
  await mkdir(musique, { recursive: true });
});

afterEach(async () => {
  await rm(racine, { recursive: true, force: true });
});

/** Trame MPEG-1 couche III valide : 200 trames donnent environ 5,2 secondes de silence. */
function donneesMp3(): Buffer {
  const trame = Buffer.alloc(417);
  trame[0] = 0xff;
  trame[1] = 0xfb;
  trame[2] = 0x90;
  return Buffer.concat(Array.from({ length: 200 }, () => trame));
}

async function mp3(chemin: string, etiquettes?: NodeID3.Tags): Promise<void> {
  const complet = join(musique, chemin);
  await mkdir(dirname(complet), { recursive: true });
  await writeFile(complet, donneesMp3());
  if (etiquettes !== undefined) NodeID3.write(etiquettes, complet);
}

async function json(chemin: string, contenu: unknown): Promise<void> {
  const complet = join(musique, chemin);
  await mkdir(dirname(complet), { recursive: true });
  await writeFile(complet, typeof contenu === 'string' ? contenu : JSON.stringify(contenu));
}

async function image(chemin: string, couleur = '#cc3300'): Promise<Buffer> {
  const donnees = await sharp({
    create: { width: 1200, height: 1200, channels: 3, background: couleur },
  })
    .png()
    .toBuffer();
  const complet = join(musique, chemin);
  await mkdir(dirname(complet), { recursive: true });
  await writeFile(complet, donnees);
  return donnees;
}

const generer = () => construireCatalogue({ racine: musique, dossierPochettes: pochettes });

describe('génération du catalogue', () => {
  it('produit un catalogue vide quand le dossier de musique est absent', async () => {
    const resultat = await construireCatalogue({
      racine: join(racine, 'absent'),
      dossierPochettes: pochettes,
    });
    expect(resultat.erreurs).toEqual([]);
    expect(resultat.catalogue).toEqual({
      version: 1,
      categories: [],
      albums: [],
      pistes: [],
      hashtags: [],
    });
  });

  it('range les pistes par catégorie, avec durée, identifiant stable et valeurs par défaut', async () => {
    await mp3('Rock & Roll/Mon Titre Été.mp3');
    await mp3('electro/t1.mp3', { title: 'Titre Un', artist: 'DJ X', year: '2023' });
    const { catalogue, erreurs } = await generer();
    expect(erreurs).toEqual([]);
    expect(catalogue.categories.map((c) => [c.slug, c.nom, c.nombrePistes])).toEqual([
      ['electro', 'electro', 1],
      ['rock-roll', 'Rock & Roll', 1],
    ]);
    const piste = catalogue.pistes.find((p) => p.id === 'rock-roll--mon-titre-ete');
    expect(piste).toMatchObject({
      titre: 'Mon Titre Été',
      artiste: 'AP3X Records',
      categorie: 'rock-roll',
      licence: 'CC BY-NC-ND 4.0',
      telechargement: false,
      fichier: 'musique/Rock%20%26%20Roll/Mon%20Titre%20%C3%89t%C3%A9.mp3',
    });
    expect(piste?.duree).toBeGreaterThan(5);
    expect(piste?.pics).toHaveLength(200);
    expect(catalogue.pistes.find((p) => p.id === 'electro--t1')).toMatchObject({
      titre: 'Titre Un',
      artiste: 'DJ X',
      date: '2023',
      copyright: '© 2023 AP3X Records',
    });
  });

  it('donne priorité à la fiche sur les tags ID3, et lit hashtags et description', async () => {
    await mp3('rock/a.mp3', { title: 'Tag', artist: 'Tag Artiste' });
    await json('rock/a.json', {
      titre: 'Fiche',
      hashtags: ['Live', '#Rock Roll'],
      description: 'Un titre #demo',
      telechargement: true,
      licence: 'CC0',
    });
    const { catalogue } = await generer();
    expect(catalogue.pistes[0]).toMatchObject({
      titre: 'Fiche',
      artiste: 'Tag Artiste',
      hashtags: ['live', 'rock-roll', 'demo'],
      telechargement: true,
      licence: 'CC0',
    });
    expect(catalogue.hashtags.map((h) => h.nom)).toEqual(['demo', 'live', 'rock-roll']);
  });

  it('assemble un album : ordre de album.json, disques, type déduit, pistes orphelines ignorées', async () => {
    await mp3('rock/mon-album/a.mp3', { title: 'Alpha', year: '2024' });
    await mp3('rock/mon-album/b.mp3', { title: 'Beta' });
    await mp3('rock/mon-album/c.mp3', { title: 'Gamma' });
    await mp3('rock/mon-album/orpheline.mp3');
    await json('rock/mon-album/album.json', {
      titre: 'Mon Album',
      reference: 'AP3X-001',
      telechargement: true,
      pistes: ['b.mp3', { fichier: 'c.mp3', disque: 2 }, 'a.mp3'],
    });
    const { catalogue, avertissements, erreurs } = await generer();
    expect(erreurs).toEqual([]);
    expect(avertissements.some((a) => a.includes('orpheline.mp3'))).toBe(true);
    const album = catalogue.albums[0];
    expect(album).toMatchObject({
      id: 'rock--mon-album',
      titre: 'Mon Album',
      type: 'ep',
      nombrePistes: 3,
      reference: 'AP3X-001',
      telechargement: true,
      date: '2024',
    });
    expect(album?.pistes).toEqual([
      'rock--mon-album--b',
      'rock--mon-album--a',
      'rock--mon-album--c',
    ]);
    const numeros = (id: string) => {
      const p = catalogue.pistes.find((x) => x.id === id);
      return [p?.disque, p?.numero];
    };
    expect(numeros('rock--mon-album--b')).toEqual([1, 1]);
    expect(numeros('rock--mon-album--a')).toEqual([1, 2]);
    expect(numeros('rock--mon-album--c')).toEqual([2, 1]);
    expect(catalogue.pistes.some((p) => p.id.endsWith('orpheline'))).toBe(false);
    expect(album?.duree).toBeCloseTo(
      catalogue.pistes
        .filter((p) => p.album === 'rock--mon-album')
        .reduce((s, p) => s + p.duree, 0),
      1,
    );
  });

  it("déduit le type d'album : single, EP puis LP", async () => {
    for (const [nom, nombre] of [
      ['un', 1],
      ['sept', 7],
    ] as const) {
      const noms = Array.from({ length: nombre }, (_, i) => `p${i}.mp3`);
      for (const n of noms) await mp3(`rock/${nom}/${n}`);
      await json(`rock/${nom}/album.json`, { titre: nom, pistes: noms });
    }
    const { catalogue } = await generer();
    expect(Object.fromEntries(catalogue.albums.map((a) => [a.titre, a.type]))).toEqual({
      un: 'single',
      sept: 'lp',
    });
  });

  it('retire les pistes et albums masqués du catalogue', async () => {
    await mp3('rock/visible.mp3');
    await mp3('rock/cachee.mp3');
    await json('rock/cachee.json', { visible: false });
    await mp3('rock/album-cache/x.mp3');
    await json('rock/album-cache/album.json', {
      titre: 'Caché',
      visible: false,
      pistes: ['x.mp3'],
    });
    const { catalogue } = await generer();
    expect(catalogue.pistes.map((p) => p.id)).toEqual(['rock--visible']);
    expect(catalogue.albums).toEqual([]);
  });

  it('range une piste dans des catégories supplémentaires (fiche ou genre ID3)', async () => {
    await mp3('rock/a.mp3');
    await mp3('techno/b.mp3', { genre: 'Rock' });
    await json('rock/a.json', { categories: ['Techno', 'Jazz'] });
    const { catalogue, avertissements } = await generer();
    expect(catalogue.pistes.find((p) => p.id === 'rock--a')?.autresCategories).toEqual(['techno']);
    expect(catalogue.pistes.find((p) => p.id === 'techno--b')?.autresCategories).toEqual(['rock']);
    expect(avertissements.some((a) => a.includes('Jazz'))).toBe(true);
    expect(catalogue.categories.map((c) => [c.slug, c.nombrePistes])).toEqual([
      ['rock', 2],
      ['techno', 2],
    ]);
  });

  it('refuse les conventions non respectées avec des messages précis', async () => {
    await mp3('racine.mp3');
    await mp3('tout/a.mp3');
    await mp3('rock/sous-dossier/x.mp3');
    await mp3('rock/b.mp3');
    await json('rock/b.json', '{ pas du json');
    await mp3('doublon/Même Nom.mp3');
    await mp3('doublon/Meme-Nom.mp3');
    await json('techno/categorie.json', { couleur: 'rouge' });
    await mp3('techno/c.mp3');
    await mp3('album/p.mp3');
    await json('album/dossier/album.json', {
      titre: 'A',
      pistes: ['p.mp3', 'p.mp3', 'absente.mp3'],
      inconnu: 1,
    });
    const { erreurs } = await generer();
    const texte = erreurs.join('\n');
    expect(texte).toContain('un MP3 doit se trouver dans un dossier de catégorie');
    expect(texte).toContain('nom de page réservé');
    expect(texte).toContain('sous-dossier avec des MP3 mais sans album.json');
    expect(texte).toContain('JSON invalide');
    expect(texte).toContain('en double');
    expect(texte).toContain('Couleur attendue');
    expect(texte).toContain('Unrecognized key');
  });

  it('signale une piste listée absente ou en double dans un album', async () => {
    await mp3('rock/alb/x.mp3');
    await json('rock/alb/album.json', { titre: 'A', pistes: ['x.mp3', 'absente.mp3', 'x.mp3'] });
    const { erreurs } = await generer();
    expect(erreurs.join('\n')).toContain('piste introuvable « absente.mp3 »');
    expect(erreurs.join('\n')).toContain('piste listée deux fois « x.mp3 »');
  });

  it('refuse un MP3 illisible', async () => {
    await mkdir(join(musique, 'rock'), { recursive: true });
    await writeFile(join(musique, 'rock', 'casse.mp3'), 'pas un mp3');
    const { erreurs } = await generer();
    expect(erreurs.join('\n')).toContain('casse.mp3');
  });
});

describe('pochettes du catalogue', () => {
  const sortie = (chemin: string) => join(racine, chemin);

  it("convertit la pochette d'un album et la donne aux pistes qui n'en ont pas", async () => {
    await mp3('rock/alb/x.mp3');
    await json('rock/alb/album.json', { titre: 'A', pistes: ['x.mp3'] });
    await image('rock/alb/cover.png');
    const { catalogue, erreurs } = await generer();
    expect(erreurs).toEqual([]);
    const album = catalogue.albums[0];
    expect(album?.pochette).toMatch(/^pochettes\/[0-9a-f]{16}\.webp$/);
    expect(album?.miniature).toMatch(/^pochettes\/[0-9a-f]{16}-m\.webp$/);
    expect(existsSync(sortie(album?.pochette ?? ''))).toBe(true);
    expect(existsSync(sortie(album?.miniature ?? ''))).toBe(true);
    expect(existsSync(sortie((album?.pochette ?? '').replace('.webp', '-og.jpg')))).toBe(true);
    expect(catalogue.pistes[0]).toMatchObject({
      pochette: album?.pochette,
      miniature: album?.miniature,
    });
    // Les originaux ne sont pas référencés : seul le dossier de pochettes générées l'est.
    expect(JSON.stringify(catalogue)).not.toContain('cover.png');
  });

  it('prend la pochette intégrée au MP3 pour une piste sans fiche de pochette', async () => {
    const donnees = await image('source.png', '#0033cc');
    await mp3('rock/a.mp3', {
      title: 'A',
      image: { mime: 'image/png', type: { id: 3 }, description: '', imageBuffer: donnees },
    });
    const { catalogue } = await generer();
    expect(catalogue.pistes[0]?.pochette).toMatch(/^pochettes\//);
    expect(existsSync(sortie(catalogue.pistes[0]?.pochette ?? ''))).toBe(true);
  });

  it('deux pistes avec la même pochette partagent les mêmes fichiers', async () => {
    const donnees = await image('source.png');
    const etiquettes = {
      image: { mime: 'image/png', type: { id: 3 }, description: '', imageBuffer: donnees },
    };
    await mp3('rock/a.mp3', etiquettes);
    await mp3('rock/b.mp3', etiquettes);
    const { catalogue } = await generer();
    expect(catalogue.pistes[0]?.pochette).toBe(catalogue.pistes[1]?.pochette);
    expect(await readdir(pochettes)).toHaveLength(3);
  });

  it('refuse une pochette déclarée mais introuvable ou illisible', async () => {
    await mp3('rock/a.mp3');
    await mp3('rock/b.mp3');
    await json('rock/a.json', { pochette: 'absente.png' });
    await writeFile(join(musique, 'rock', 'fausse.png'), 'pas une image');
    await json('rock/b.json', { pochette: 'fausse.png' });
    const { erreurs } = await generer();
    expect(erreurs.join('\n')).toContain('pochette introuvable');
    expect(erreurs.join('\n')).toContain('pochette illisible');
  });

  it('supprime les pochettes générées devenues inutiles', async () => {
    await mp3('rock/a.mp3');
    await image('rock/cover.png', '#ff0000');
    const premier = await generer();
    expect(await readdir(pochettes)).toHaveLength(3);
    expect(await premier.nettoyerPochettes()).toBe(0);

    await image('rock/cover.png', '#00ff00');
    const second = await generer();
    expect(await readdir(pochettes)).toHaveLength(6);
    expect(await second.nettoyerPochettes()).toBe(3);
    expect(await readdir(pochettes)).toHaveLength(3);
  });
});

describe("fiches produites par la page d'administration", () => {
  it('une piste créée par le formulaire (MP3, fiche JSON, pochette WebP) entre dans le catalogue', async () => {
    const formulaire = {
      ...formulaireVide('ambient'),
      titre: 'Étoile filante',
      artiste: 'Zoé',
      hashtags: '#Nuit claire',
      date: '2025-03-14',
      telechargement: true,
    };
    const base = nomFichierPiste(formulaire.titre);
    await mp3(`ambient/${base}.mp3`);
    await json(`ambient/${base}.json`, construireFiche(formulaire, `${base}.webp`));
    const webp = await sharp({
      create: { width: 600, height: 600, channels: 3, background: '#3366cc' },
    })
      .webp()
      .toBuffer();
    await mkdir(join(musique, 'ambient'), { recursive: true });
    await writeFile(join(musique, 'ambient', `${base}.webp`), webp);

    const { catalogue, erreurs } = await generer();
    expect(erreurs).toEqual([]);
    expect(catalogue.pistes[0]).toMatchObject({
      id: 'ambient--etoile-filante',
      titre: 'Étoile filante',
      artiste: 'Zoé',
      hashtags: ['nuit', 'claire'],
      date: '2025-03-14',
      telechargement: true,
      categorie: 'ambient',
    });
    expect(catalogue.pistes[0]?.pochette).toBeDefined();
  });

  it('un brouillon est absent du catalogue', async () => {
    const formulaire = { ...formulaireVide('ambient'), titre: 'Brouillon', visible: false };
    await mp3('ambient/brouillon.mp3');
    await json('ambient/brouillon.json', construireFiche(formulaire));
    const { catalogue, erreurs } = await generer();
    expect(erreurs).toEqual([]);
    expect(catalogue.pistes).toEqual([]);
  });
});
