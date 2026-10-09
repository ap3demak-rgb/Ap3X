// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Page } from '@playwright/test';
import { CatalogueSchema, type Catalogue, type Piste } from '../../src/catalogue/schemas';

/** Tous les fichiers audio du catalogue de test pointent vers le vrai MP3 du dépôt. */
const FICHIER_AUDIO = 'musique/techno/300.mp3';

function piste(id: string, titre: string, extras: Partial<Piste> & { categorie: string }): Piste {
  return {
    id,
    titre,
    artiste: 'AP3X Records',
    description: '',
    hashtags: [],
    duree: 120,
    fichier: FICHIER_AUDIO,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
    pics: Array.from({ length: 200 }, (_, i) => 20 + Math.round(60 * Math.abs(Math.sin(i / 9)))),
    ...extras,
  };
}

/**
 * Catalogue de test : 3 catégories, un EP sur deux disques, un single, des pistes hors album, une piste
 * rangée dans deux catégories, et des hashtags partagés.
 */
export const CATALOGUE_TEST: Catalogue = CatalogueSchema.parse({
  version: 1,
  categories: [
    {
      slug: 'ambient',
      nom: 'Ambient',
      description: 'Textures lentes.',
      nombrePistes: 2,
      nombreAlbums: 0,
    },
    { slug: 'rock-roll', nom: "Rock'n'Roll", description: '', nombrePistes: 3, nombreAlbums: 1 },
    {
      slug: 'techno',
      nom: 'Techno',
      description: 'Rythmes rapides.',
      nombrePistes: 2,
      nombreAlbums: 1,
    },
  ],
  albums: [
    {
      id: 'rock-roll--mon-album',
      titre: 'Mon Album',
      artiste: 'AP3X Records',
      type: 'ep',
      date: '2024-05',
      description: 'Un EP sur deux disques.',
      hashtags: ['live'],
      licence: 'CC BY-NC-ND 4.0',
      copyright: '© 2024 AP3X Records',
      reference: 'AP3X-001',
      telechargement: true,
      categorie: 'rock-roll',
      pistes: ['rock-roll--mon-album--r1', 'rock-roll--mon-album--r2', 'rock-roll--mon-album--r3'],
      nombrePistes: 3,
      duree: 360,
    },
    {
      id: 'techno--single-x',
      titre: 'Single X',
      artiste: 'DJ X',
      type: 'single',
      date: '2025',
      description: '',
      hashtags: [],
      licence: 'CC BY-NC-ND 4.0',
      copyright: '© 2025 AP3X Records',
      categorie: 'techno',
      pistes: ['techno--single-x--t1'],
      nombrePistes: 1,
      duree: 120,
    },
  ],
  pistes: [
    piste('rock-roll--mon-album--r1', 'Alpha', {
      categorie: 'rock-roll',
      album: 'rock-roll--mon-album',
      numero: 1,
      disque: 1,
      date: '2024-05',
      hashtags: ['live'],
    }),
    piste('rock-roll--mon-album--r2', 'Beta', {
      categorie: 'rock-roll',
      album: 'rock-roll--mon-album',
      numero: 2,
      disque: 1,
      date: '2024-05',
      hashtags: ['live', 'demo'],
    }),
    piste('rock-roll--mon-album--r3', 'Gamma', {
      categorie: 'rock-roll',
      album: 'rock-roll--mon-album',
      numero: 1,
      disque: 2,
      date: '2024-05',
      duree: 200,
      telechargement: true,
    }),
    piste('techno--single-x--t1', 'Zenith', {
      categorie: 'techno',
      album: 'techno--single-x',
      numero: 1,
      disque: 1,
      date: '2025',
      artiste: 'DJ X',
    }),
    piste('techno--t2', 'Night Drive', {
      categorie: 'techno',
      autresCategories: ['ambient'],
      date: '2023',
      hashtags: ['demo', 'nuit'],
      description: 'Une piste #nuit.',
    }),
    piste('ambient--a1', 'Brume', {
      categorie: 'ambient',
      date: '2022-11-03',
      hashtags: ['nuit'],
      duree: 300,
    }),
  ],
  hashtags: [
    { nom: 'demo', pistes: ['rock-roll--mon-album--r2', 'techno--t2'] },
    { nom: 'live', pistes: ['rock-roll--mon-album--r1', 'rock-roll--mon-album--r2'] },
    { nom: 'nuit', pistes: ['techno--t2', 'ambient--a1'] },
  ],
});

/**
 * Reproduit la règle de lecture automatique des navigateurs, quel que soit l'environnement : `play()`
 * est refusé (`NotAllowedError`) sauf juste après un vrai geste de l'utilisateur (clic, touche, toucher ;
 * les clics de Playwright sont des événements fiables). On n'utilise ni les options de lancement ni
 * `navigator.userActivation` : leur effet varie selon le système, et Playwright lui-même marque la page
 * comme activée après une navigation.
 */
export async function refuserLectureAutomatique(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const DELAI_GESTE_MS = 1500;
    let dernierGeste = Number.NEGATIVE_INFINITY;
    for (const type of ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'click']) {
      window.addEventListener(
        type,
        (evenement) => {
          if (evenement.isTrusted) dernierGeste = performance.now();
        },
        true,
      );
    }
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement): Promise<void> {
      if (performance.now() - dernierGeste > DELAI_GESTE_MS) {
        return Promise.reject(new DOMException('Lecture automatique refusée', 'NotAllowedError'));
      }
      return original.call(this);
    };
  });
}

/**
 * Remplace le catalogue servi par le site par le catalogue de test. Par défaut, la lecture automatique
 * est refusée (voir `refuserLectureAutomatique`) ; les tests qui l'exigent autorisée passent `false`.
 */
export async function servirCatalogueTest(page: Page, lectureAutoRefusee = true): Promise<void> {
  if (lectureAutoRefusee) await refuserLectureAutomatique(page);
  await page.route('**/catalogue.json', (route) => route.fulfill({ json: CATALOGUE_TEST }));
}
