// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { CatalogueSchema } from '../src/catalogue/schemas';
import { refuserLectureAutomatique } from './fixtures/catalogue';

// Mouvement réduit : pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

/** Catalogue de 130 pistes hors album dans une seule catégorie, sans date : l'ordre est alphabétique. */
function grandCatalogue(nombre: number) {
  return CatalogueSchema.parse({
    version: 1,
    categories: [
      { slug: 'vrac', nom: 'Vrac', description: '', nombrePistes: nombre, nombreAlbums: 0 },
    ],
    albums: [],
    pistes: Array.from({ length: nombre }, (_, i) => {
      const numero = String(i + 1).padStart(3, '0');
      return {
        id: `vrac--p${numero}`,
        titre: `Piste ${numero}`,
        artiste: 'AP3X Records',
        description: '',
        hashtags: [],
        categorie: 'vrac',
        duree: 120,
        fichier: 'musique/techno/300.mp3',
        telechargement: false,
        licence: 'CC BY-NC-ND 4.0',
        copyright: '© 2026 AP3X Records',
      };
    }),
    hashtags: [],
  });
}

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

async function servir(page: import('@playwright/test').Page, nombre: number): Promise<void> {
  await page.route('**/catalogue.json', (route) => route.fulfill({ json: grandCatalogue(nombre) }));
}

const cartes = (page: import('@playwright/test').Page) => page.locator('main .carte');

test("une grande liste s'affiche par pages de 48 avec « Voir plus »", async ({ page }) => {
  await servir(page, 130);
  await page.goto('./#/categorie/tout');
  await expect(cartes(page)).toHaveCount(48);
  await expect(page.getByText('Showing 48 of 130')).toBeVisible();

  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(cartes(page)).toHaveCount(96);
  await expect(page.getByText('Showing 96 of 130')).toBeVisible();
  // Le focus passe à la première carte ajoutée, pour poursuivre la lecture au clavier.
  await expect(page.getByRole('link', { name: 'Piste 049' })).toBeFocused();
  await expect(page.locator('.annonceur')).toContainText('Showing 96 of 130', { timeout: 8000 });

  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(cartes(page)).toHaveCount(130);
  await expect(page.getByText('Showing 130 of 130')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Piste 097' })).toBeFocused();
  await expect(page.getByRole('button', { name: 'Show more' })).toBeHidden();
});

test('changer le tri revient à la première page', async ({ page }) => {
  await servir(page, 130);
  await page.goto('./#/categorie/tout');
  await page.getByRole('button', { name: 'Show more' }).click();
  await expect(cartes(page)).toHaveCount(96);
  await page.getByLabel('Sort by').selectOption({ label: 'Title (A–Z)' });
  await expect(cartes(page)).toHaveCount(48);
  await expect(cartes(page).first().getByRole('link', { name: 'Piste 001' })).toBeVisible();
});

test("une liste courte n'a ni pied de pagination ni bouton", async ({ page }) => {
  await servir(page, 20);
  await page.goto('./#/categorie/tout');
  await expect(cartes(page)).toHaveCount(20);
  await expect(page.getByRole('button', { name: 'Show more' })).toHaveCount(0);
  await expect(page.getByText(/Showing/)).toHaveCount(0);
});

test('« Tout lire » concerne toute la liste, pas seulement la page affichée', async ({ page }) => {
  await servir(page, 130);
  await page.goto('./#/categorie/tout');
  await page.getByRole('button', { name: 'Play all : All' }).click();
  await page.getByRole('button', { name: 'Queue', exact: true }).click();
  await expect(page.locator('.lecteur-file li')).toHaveCount(130);
});

test('les résultats de recherche sont paginés eux aussi', async ({ page }) => {
  await servir(page, 130);
  await page.goto('./#/recherche/piste');
  await expect(cartes(page)).toHaveCount(48);
  await expect(page.getByText('Showing 48 of 130')).toBeVisible();
});

test('aucune violation axe (WCAG AAA) sur une liste paginée', async ({ page }) => {
  await servir(page, 130);
  await page.goto('./#/categorie/tout');
  await expect(cartes(page)).toHaveCount(48);
  const resultat = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag2aaa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'])
    .analyze();
  expect(
    resultat.violations.map(
      (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
    ),
  ).toEqual([]);
});
