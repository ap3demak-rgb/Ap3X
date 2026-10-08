// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test, type ConsoleMessage } from '@playwright/test';

/** Erreurs de console à surveiller pendant chaque parcours. */
function surveillerConsole(page: import('@playwright/test').Page): ConsoleMessage[] {
  const erreurs: ConsoleMessage[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') erreurs.push(message);
  });
  page.on('pageerror', (erreur) => {
    throw erreur;
  });
  return erreurs;
}

test("la page d'accueil affiche les cartes et la barre de lecture", async ({ page }) => {
  const erreurs = surveillerConsole(page);
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
  await expect(page.locator('.carte').first()).toBeVisible();
  await expect(page.getByRole('region', { name: /./ }).first()).toBeVisible();
  await expect(page.locator('.lecteur')).toBeVisible();
  expect(erreurs.map((e) => e.text())).toEqual([]);
});

test('lire une piste fait avancer la lecture et la barre', async ({ page }) => {
  const erreurs = surveillerConsole(page);
  await page.goto('./');
  await page.locator('.carte').first().getByRole('button').first().click();
  const titre = page.locator('.lecteur-titre');
  await expect(titre).not.toHaveText('');
  await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', /pause|Pause/);
  await expect
    .poll(async () => page.locator('.lecteur-curseur').first().inputValue(), { timeout: 10000 })
    .not.toBe('0');
  expect(erreurs.map((e) => e.text())).toEqual([]);
});

test("la page d'une piste affiche la waveform et permet de se déplacer", async ({ page }) => {
  await page.goto('./');
  await page.locator('.carte-titre a').first().click();
  await expect(page).toHaveURL(/#\/piste\//);
  const onde = page.locator('.onde-grande');
  await expect(onde).toBeVisible();
  await onde.locator('.onde-curseur').click({ position: { x: 500, y: 40 } });
  await expect(page.locator('.lecteur-titre')).not.toHaveText('');
  const valeur = Number(await page.locator('.onde-grande .onde-curseur').inputValue());
  expect(valeur).toBeGreaterThan(100);
});

test("le changement de langue met à jour l'attribut lang et les libellés", async ({ page }) => {
  await page.goto('./');
  await page.getByLabel(/Language|Langue/).selectOption('fr');
  await expect(page.locator('html')).toHaveAttribute('lang', 'fr');
  await expect(page.getByRole('link', { name: 'Licences' })).toBeVisible();
});

test("une piste inconnue affiche un message avec retour à l'accueil", async ({ page }) => {
  await page.goto('./#/piste/inconnue');
  await expect(page.locator('main').getByRole('alert')).toBeVisible();
  await page.getByRole('link', { name: /Back to home|Retour/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});

test('aucun texte de l\x27accueil ne contient de variable de traduction non remplacée', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  expect(await page.locator('body').innerText()).not.toMatch(/{w+}/);
});

test('la page des albums affiche son message quand aucun album ne correspond', async ({ page }) => {
  await page.goto('./#/albums');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  await expect(page.getByText(/No album matches|Aucun album/)).toBeVisible();
});
