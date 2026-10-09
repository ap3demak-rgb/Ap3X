// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test } from '@playwright/test';
import { refuserLectureAutomatique, servirCatalogueTest } from './fixtures/catalogue';

// Parcours de base exécuté dans tous les navigateurs (projets firefox, webkit et mobiles de
// playwright.config.ts) : le rendu, la navigation, la recherche, la langue et les pages d'un album.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

test('accueil, barre de lecture et navigation sans erreur de console', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') erreurs.push(m.text());
  });
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
  await expect(page.locator('.carte').first()).toBeVisible();
  await expect(page.locator('.lecteur')).toBeVisible();

  await page.goto('./#/albums');
  await expect(page.locator('main h1')).toBeVisible();
  await page.goto('./#/licences');
  await expect(page.locator('main h1')).toBeVisible();
  expect(erreurs).toEqual([]);
});

test('la recherche trouve une piste et ouvre sa page', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await page.getByRole('searchbox').fill('brume');
  await page.getByRole('searchbox').press('Enter');
  await expect(page).toHaveURL(/#\/recherche/);
  await page.getByRole('link', { name: 'Brume' }).first().click();
  await expect(page).toHaveURL(/#\/piste\//);
  await expect(page.locator('main h1')).toHaveText('Brume');
});

test('le changement de langue traduit la page et met à jour l’attribut lang', async ({ page }) => {
  await page.goto('./#/licences');
  await expect(page.locator('main h1')).toBeVisible();
  await page.getByLabel(/language/i).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.locator('main h1')).not.toHaveText('Licenses');
});

test('une piste se met en lecture au clic (Media Session et barre à jour)', async ({ page }) => {
  await refuserLectureAutomatique(page);
  await page.goto('./');
  await page.locator('.carte').first().getByRole('button').first().click();
  await expect(page.locator('.lecteur-titre')).not.toHaveText('');
});
