// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

test('catalogue injoignable : message, bouton « Retry », puis le contenu apparaît', async ({
  page,
}) => {
  await page.route('**/catalogue.json', (route) => route.abort('connectionfailed'));
  await page.goto('./');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Unable to load the content.' }),
  ).toBeVisible();
  const reessayer = page.getByRole('button', { name: 'Retry' });
  await expect(reessayer).toBeVisible();

  await page.unroute('**/catalogue.json');
  await reessayer.click();
  await expect(page.locator('.carte').first()).toBeVisible();
  await expect(page.getByRole('button', { name: 'Retry' })).toHaveCount(0);
});

test('catalogue invalide : message d’erreur au lieu d’une page vide', async ({ page }) => {
  await page.route('**/catalogue.json', (route) => route.fulfill({ json: { inattendu: true } }));
  await page.goto('./');
  await expect(
    page.getByRole('alert').filter({ hasText: 'Unable to load the content.' }),
  ).toBeVisible();
});

test('fichier audio introuvable : le lecteur signale que la piste est illisible', async ({
  page,
}) => {
  await page.route('**/musique/**', (route) => route.fulfill({ status: 404, body: '' }));
  await page.goto('./');
  await page.locator('.carte-titre a').first().click();
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await expect(page.locator('.lecteur-erreur')).toHaveText(/This track cannot be played/);
});

test('connexion coupée pendant le chargement du fichier : même signalement, sans exception', async ({
  page,
}) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.route('**/musique/**', (route) => route.abort('connectionreset'));
  await page.goto('./');
  await page.locator('.carte-titre a').first().click();
  await page.getByRole('button', { name: /^Play/ }).first().click();
  await expect(page.locator('.lecteur-erreur')).toHaveText(/This track cannot be played/);
  expect(erreurs).toEqual([]);
});
