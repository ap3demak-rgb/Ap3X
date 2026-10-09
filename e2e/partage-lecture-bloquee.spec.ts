// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test, type Page } from '@playwright/test';
import { servirCatalogueTest } from './fixtures/catalogue';

// Mouvement réduit : pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  // Lecture automatique refusée par défaut : voir `refuserLectureAutomatique`.
  await servirCatalogueTest(page);
});

const lireJeton = (page: Page) => page.locator('.lecteur-titre');
const progression = async (page: Page): Promise<number> =>
  Number(await page.locator('.lecteur-curseur').first().inputValue());

test.describe('ouvrir un lien partagé (lecture automatique refusée)', () => {
  test('charge la piste à la bonne position et invite à appuyer sur Lecture', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1?t=1m30s');
    await expect(lireJeton(page)).toHaveText('Brume');
    await expect(
      page
        .getByRole('status')
        .filter({ hasText: 'Your browser blocked autoplay: press Play to listen.' }),
    ).toBeVisible();
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Play');
    await expect(page.locator('.annonceur')).toContainText('blocked autoplay', { timeout: 8000 });
    await expect.poll(() => progression(page)).toBeGreaterThanOrEqual(90);
    // Un clic de l'utilisateur démarre bien la lecture à cette position.
    await page.locator('.lecteur-lecture').click();
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
    expect(await progression(page)).toBeGreaterThanOrEqual(90);
  });

  test("un refus n'est pas une erreur de piste", async ({ page }) => {
    await page.goto('./#/piste/ambient--a1');
    await expect(lireJeton(page)).toHaveText('Brume');
    await expect(page.getByText('This track cannot be played.')).toHaveCount(0);
    await expect(page.locator('.lecteur-erreur')).toHaveText('');
  });
});
