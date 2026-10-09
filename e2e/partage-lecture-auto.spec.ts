// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test, type Page } from '@playwright/test';
import { servirCatalogueTest } from './fixtures/catalogue';

// La politique de lecture automatique du navigateur est fixée par le projet Playwright de ce fichier
// (voir playwright.config.ts). Mouvement réduit : pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

const lireJeton = (page: Page) => page.locator('.lecteur-titre');
const progression = async (page: Page): Promise<number> =>
  Number(await page.locator('.lecteur-curseur').first().inputValue());

test.describe('ouvrir un lien partagé (lecture automatique autorisée)', () => {
  test("lance la lecture à l'ouverture du site, à l'instant demandé", async ({ page }) => {
    await page.goto('./#/piste/ambient--a1?t=1m30s');
    await expect(lireJeton(page)).toHaveText('Brume');
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
    await expect.poll(() => progression(page)).toBeGreaterThanOrEqual(90);
  });

  test("lance la lecture d'une piste sans instant, depuis le début", async ({ page }) => {
    await page.goto('./#/piste/techno--t2');
    await expect(lireJeton(page)).toHaveText('Night Drive');
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
  });

  test("la lecture d'un album démarre sur la piste du lien, avec le reste de l'album en file", async ({
    page,
  }) => {
    await page.goto('./#/piste/rock-roll--mon-album--r2');
    await expect(lireJeton(page)).toHaveText('Beta');
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    await expect(page.locator('.lecteur-file li')).toHaveCount(3);
  });

  test('parcourir le site ne lance pas la lecture', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carte').first()).toBeVisible();
    await page.locator('.carte-titre a').first().click();
    await expect(page).toHaveURL(/#\/piste\//);
    await expect(lireJeton(page)).toHaveText('Nothing playing');
  });

  test("coller un lien avec un instant dans l'onglet ouvert lance la lecture", async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carte').first()).toBeVisible();
    await expect(lireJeton(page)).toHaveText('Nothing playing');
    await page.evaluate(() => {
      window.location.hash = '#/piste/ambient--a1?t=40';
    });
    await expect(lireJeton(page)).toHaveText('Brume');
    await expect.poll(() => progression(page)).toBeGreaterThanOrEqual(40);
  });

  test('changer de langue ne relance pas la lecture', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1?t=10');
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByLabel('Language').selectOption('fr');
    await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Lecture');
  });

  test('un lien vers une piste inconnue ne casse rien', async ({ page }) => {
    await page.goto('./#/piste/inconnue?t=10');
    await expect(page.locator('main').getByRole('alert')).toHaveText('Track not found.');
    await expect(lireJeton(page)).toHaveText('Nothing playing');
  });
});
