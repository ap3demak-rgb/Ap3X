// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { CATALOGUE_TEST } from './fixtures/catalogue';

// Mouvement réduit : pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

const MP3 = readFileSync('public/musique/techno/300.mp3');

/** Catalogue de test dont chaque piste de l'album « Mon Album » a son propre fichier audio. */
async function servirAlbumAvecFichiers(page: Page): Promise<string[]> {
  const demandes: string[] = [];
  const catalogue = {
    ...CATALOGUE_TEST,
    pistes: CATALOGUE_TEST.pistes.map((piste) =>
      piste.album === 'rock-roll--mon-album'
        ? { ...piste, fichier: `musique/faux/${piste.id.split('--').pop() ?? ''}.mp3` }
        : piste,
    ),
  };
  await page.route('**/catalogue.json', (route) => route.fulfill({ json: catalogue }));
  await page.route('**/musique/faux/*.mp3', async (route) => {
    demandes.push(new URL(route.request().url()).pathname.split('/').pop() ?? '');
    await route.fulfill({
      body: MP3,
      contentType: 'audio/mpeg',
      headers: { 'accept-ranges': 'bytes' },
    });
  });
  return demandes;
}

test("seules les métadonnées de la piste courante sont demandées tant qu'on n'écoute pas", async ({
  page,
}) => {
  const demandes = await servirAlbumAvecFichiers(page);
  await page.goto('./#/album/rock-roll--mon-album');
  await expect(page.getByRole('heading', { level: 1, name: 'Mon Album' })).toBeVisible();
  await page.getByRole('button', { name: 'Add to queue : Mon Album' }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(page.locator('.lecteur-file li')).toHaveCount(3);
  await page.waitForTimeout(1000);
  // Seules les métadonnées de la piste courante (preload="metadata") : jamais les pistes suivantes.
  expect([...new Set(demandes)].filter((nom) => nom !== 'r1.mp3')).toEqual([]);
});

test("la piste suivante n'est préchargée qu'une fois la lecture commencée, et elle seule", async ({
  page,
}) => {
  const demandes = await servirAlbumAvecFichiers(page);
  await page.goto('./#/album/rock-roll--mon-album');
  await page.getByRole('button', { name: 'Play album : Mon Album' }).click();
  await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
  await expect.poll(() => [...new Set(demandes)].sort()).toEqual(['r1.mp3', 'r2.mp3']);
  // La troisième piste n'est pas demandée avant son tour.
  await page.waitForTimeout(800);
  expect(demandes).not.toContain('r3.mp3');
});

test('les pochettes des cartes sont chargées à la demande (lazy)', async ({ page }) => {
  await page.route('**/catalogue.json', (route) =>
    route.fulfill({
      json: {
        ...CATALOGUE_TEST,
        pistes: CATALOGUE_TEST.pistes.map((piste) => ({
          ...piste,
          pochette: 'pochettes/test.webp',
        })),
      },
    }),
  );
  await page.route('**/pochettes/test.webp', (route) => route.fulfill({ status: 404 }));
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  const chargements = await page
    .locator('img.pochette')
    .evaluateAll((images) => images.map((image) => (image as HTMLImageElement).loading));
  expect(chargements.length).toBeGreaterThan(0);
  expect(new Set(chargements)).toEqual(new Set(['lazy']));
});
