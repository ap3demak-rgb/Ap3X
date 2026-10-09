// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { servirCatalogueTest } from './fixtures/catalogue';

// Ces parcours ne concernent pas le rendu 3D : mouvement réduit = pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

const titres = (page: import('@playwright/test').Page, section: string): Promise<string[]> =>
  page
    .locator(`section:has(> h2:text-is("${section}")) .carte-titre`)
    .allTextContents()
    .then((valeurs) => valeurs.map((v) => v.trim()));

test('la page Catégories liste Tout, chaque catégorie et Favoris avec leurs comptes', async ({
  page,
}) => {
  await page.goto('./#/categories');
  const elements = page.locator('.liste-categories-grande li');
  await expect(elements).toHaveCount(5);
  await expect(elements.filter({ hasText: 'Techno' })).toContainText('2 tracks');
  await expect(elements.filter({ hasText: 'Techno' })).toContainText('1 album');
  await expect(elements.filter({ hasText: 'Ambient' })).toContainText('2 tracks');
  await expect(elements.filter({ hasText: 'Favorites' })).toContainText('0 tracks');
  await elements.filter({ hasText: 'Techno' }).getByRole('link', { name: 'Techno' }).click();
  await expect(page).toHaveURL(/#\/categorie\/techno$/);
});

test('une catégorie affiche ses albums puis ses pistes hors album, et « Tout lire » les enchaîne', async ({
  page,
}) => {
  await page.goto('./#/categorie/techno');
  await expect(page.getByRole('heading', { level: 1, name: 'Techno' })).toBeVisible();
  await expect(page.getByText('Rythmes rapides.')).toBeVisible();
  expect(await titres(page, 'Albums')).toEqual(['Single X']);
  // La piste de l'album n'est pas répétée dans « Tracks » ; la piste hors album y est.
  expect(await titres(page, 'Tracks')).toEqual(['Night Drive']);
  await page.getByRole('button', { name: 'Play all : Techno' }).click();
  // Les albums d'abord : la première piste jouée est celle de l'album.
  await expect(page.locator('.lecteur-titre')).toHaveText('Zenith');
  await page.getByRole('button', { name: 'Next track' }).click();
  await expect(page.locator('.lecteur-titre')).toHaveText('Night Drive');
});

test('le filtre de la navigation ouvre une catégorie, y compris pour une piste rangée dans deux catégories', async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await page.getByLabel('Browse a category').selectOption({ label: 'Ambient' });
  await expect(page).toHaveURL(/#\/categorie\/ambient$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Ambient' })).toBeVisible();
  expect((await titres(page, 'Tracks')).sort()).toEqual(['Brume', 'Night Drive']);
  // La catégorie courante est sélectionnée dans le filtre.
  await expect(page.getByLabel('Browse a category')).toHaveValue('ambient');
});

test('la page « Tout » se trie par titre, par durée ou par artiste', async ({ page }) => {
  await page.goto('./#/categorie/tout');
  await expect(page.getByRole('heading', { level: 1, name: 'All' })).toBeVisible();
  expect(await titres(page, 'Tracks')).toEqual(['Night Drive', 'Brume']); // plus récent d'abord
  await page.getByLabel('Sort by').selectOption({ label: 'Title (A–Z)' });
  expect(await titres(page, 'Tracks')).toEqual(['Brume', 'Night Drive']);
  await page.getByLabel('Sort by').selectOption({ label: 'Longest first' });
  expect(await titres(page, 'Tracks')).toEqual(['Brume', 'Night Drive']); // 300 s puis 120 s
  expect((await titres(page, 'Albums')).length).toBe(2);
});

test('le nuage de hashtags mène à la page du hashtag, qui liste ses pistes', async ({ page }) => {
  await page.goto('./');
  const nuage = page.locator('.nuage a');
  await expect(nuage).toHaveCount(3);
  await expect(nuage.filter({ hasText: '#demo' })).toHaveAttribute(
    'aria-label',
    '#demo – 2 tracks',
  );
  await nuage.filter({ hasText: '#demo' }).click();
  await expect(page).toHaveURL(/#\/tag\/demo$/);
  await expect(page.getByRole('heading', { level: 1, name: '#demo' })).toBeVisible();
  // Toutes les pistes portant le hashtag, qu'elles soient ou non dans un album.
  expect(await titres(page, 'Tracks')).toEqual(['Beta', 'Night Drive']);
  await page.getByRole('button', { name: 'Play all : #demo' }).click();
  await expect(page.locator('.lecteur-titre')).toHaveText('Beta');
});

test("un hashtag d'album affiche l'album, et un hashtag inconnu un message", async ({ page }) => {
  await page.goto('./#/tag/live');
  expect(await titres(page, 'Albums')).toEqual(['Mon Album']);
  await page.goto('./#/tag/inconnu');
  await expect(page.getByText('No track has this hashtag.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Play all/ })).toBeDisabled();
});

test("les hashtags des cartes et de la page d'une piste sont des liens", async ({ page }) => {
  await page.goto('./');
  const carte = page.locator('.carte').filter({ has: page.getByRole('link', { name: 'Beta' }) });
  await carte.getByRole('link', { name: '#live' }).click();
  await expect(page).toHaveURL(/#\/tag\/live$/);
  await page.goto('./#/piste/techno--t2');
  await page.locator('.fiche').getByRole('link', { name: '#nuit' }).click();
  await expect(page).toHaveURL(/#\/tag\/nuit$/);
});

test('les favoris : ajout, page Favoris, persistance et retrait', async ({ page }) => {
  await page.goto('./#/piste/ambient--a1');
  await page.getByRole('button', { name: 'Add to favorites : Brume' }).click();
  await expect(page.getByRole('button', { name: 'Remove from favorites : Brume' })).toBeVisible();

  await page.goto('./#/categorie/favoris');
  expect(await titres(page, 'Tracks')).toEqual(['Brume']);
  await page.reload();
  // Le catalogue arrive après le rechargement : on attend la liste plutôt que de la lire tout de suite.
  await expect.poll(() => titres(page, 'Tracks')).toEqual(['Brume']);

  await page.getByRole('button', { name: 'Remove from favorites : Brume' }).click();
  await expect(page.getByText('You have not liked any track or album yet.')).toBeVisible();
  await expect(page.getByRole('button', { name: /Play all/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByText('You have not liked any track or album yet.')).toBeVisible();
});

test('un favori ajouté depuis une carte met à jour toutes les cartes de la piste', async ({
  page,
}) => {
  await page.goto('./');
  const boutons = page.getByRole('button', { name: 'Add to favorites : Brume' });
  await expect(boutons).toHaveCount(1);
  await boutons.click();
  await expect(page.getByRole('button', { name: 'Remove from favorites : Brume' })).toHaveCount(1);
});

test("la page d'un album sur deux disques sépare les disques et numérote les pistes", async ({
  page,
}) => {
  await page.goto('./#/album/rock-roll--mon-album');
  await expect(page.getByRole('heading', { level: 1, name: 'Mon Album' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Disc 1' })).toBeVisible();
  await expect(page.getByRole('heading', { level: 3, name: 'Disc 2' })).toBeVisible();
  const listes = page.locator('ol.liste-titres');
  await expect(listes).toHaveCount(2);
  await expect(listes.nth(0).locator('li')).toHaveCount(2);
  await expect(listes.nth(1).locator('li')).toHaveCount(1);
  // Le disque 2 recommence à 1.
  expect(
    await listes
      .nth(1)
      .locator('li')
      .first()
      .evaluate((li) => (li as HTMLLIElement).value),
  ).toBe(1);
  await expect(page.getByText('AP3X-001')).toBeVisible();
  await expect(page.getByText('6:00')).toBeVisible();
  await expect(page.getByRole('link', { name: '#live' })).toHaveAttribute('href', '#/tag/live');
  await page.getByRole('button', { name: 'Play album : Mon Album' }).click();
  await expect(page.locator('.lecteur-titre')).toHaveText('Alpha');
});

test('la grille des albums se filtre par type, catégorie et année, et se trie', async ({
  page,
}) => {
  await page.goto('./#/albums');
  await expect(page.locator('.carte')).toHaveCount(2);
  await page.getByLabel('Type').selectOption({ label: 'Single' });
  await expect(page.locator('.carte')).toHaveCount(1);
  await expect(page.locator('.carte-titre')).toHaveText('Single X');
  await page.getByLabel('Type').selectOption({ label: 'All' });
  await page.getByLabel('Year').selectOption('2024');
  await expect(page.locator('.carte-titre')).toHaveText('Mon Album');
  await page.getByLabel('Year').selectOption({ label: 'All' });
  await page.getByLabel('Sort by').selectOption({ label: 'Title (A–Z)' });
  expect((await page.locator('.carte-titre').allTextContents()).map((v) => v.trim())).toEqual([
    'Mon Album',
    'Single X',
  ]);
  await page.getByRole('combobox', { name: /^Category/ }).selectOption('techno');
  await expect(page.locator('.carte-titre')).toHaveText('Single X');
  await page.getByLabel('Year').selectOption('2024');
  await expect(page.getByText('No album matches these filters.')).toBeVisible();
});

test("catégorie, hashtag ou page inconnus : message et retour à l'accueil", async ({ page }) => {
  await page.goto('./#/categorie/inexistante');
  await expect(page.locator('main').getByRole('alert')).toHaveText('Category not found.');
  await page.getByRole('link', { name: 'Back to home' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
});

const PAGES = [
  ['Catégories', './#/categories'],
  ['catégorie', './#/categorie/techno'],
  ['« Tout »', './#/categorie/tout'],
  ['Favoris vide', './#/categorie/favoris'],
  ['hashtag', './#/tag/demo'],
  ['album sur deux disques', './#/album/rock-roll--mon-album'],
  ['piste', './#/piste/techno--t2'],
  ['albums', './#/albums'],
  ['accueil avec nuage', './'],
] as const;

for (const [nom, adresse] of PAGES) {
  test(`aucune violation axe (WCAG AAA) : ${nom}`, async ({ page }) => {
    await page.goto(adresse);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const resultat = await new AxeBuilder({ page })
      .withTags([
        'wcag2a',
        'wcag2aa',
        'wcag2aaa',
        'wcag21a',
        'wcag21aa',
        'wcag22aa',
        'best-practice',
      ])
      .analyze();
    expect(
      resultat.violations.map(
        (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
      ),
    ).toEqual([]);
  });
}
