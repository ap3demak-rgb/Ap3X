// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** PNG de 1 × 1 pixel, suffisant comme texture de pochette. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==',
  'base64',
);

/** Sert un catalogue dont la première piste a une pochette. */
async function avecPochette(page: Page): Promise<void> {
  await page.route('**/catalogue.json', async (route) => {
    const reponse = await route.fetch();
    const catalogue = (await reponse.json()) as { pistes: { pochette?: string }[] };
    const premiere = catalogue.pistes[0];
    if (premiere !== undefined) premiere.pochette = 'pochettes/test.png';
    await route.fulfill({ response: reponse, json: catalogue });
  });
  await page.route('**/pochettes/test.png', (route) =>
    route.fulfill({ body: PNG_1X1, contentType: 'image/png' }),
  );
}

test.describe('rendu 3D actif', () => {
  test('le fond animé et le visualiseur sont affichés, sans erreur', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('console', (m) => {
      if (m.type() === 'error') erreurs.push(m.text());
    });
    page.on('pageerror', (e) => erreurs.push(e.message));
    await page.goto('./');
    await expect(page.locator('canvas.fond-3d')).toHaveCount(1);
    await expect(page.locator('.visualiseur-canvas')).toBeVisible();
    await expect(page.locator('.visualiseur')).toHaveAttribute('aria-hidden', 'true');
    await expect(page.locator('canvas.fond-3d')).toHaveAttribute('aria-hidden', 'true');
    // Une seule instance WebGL : un seul canvas WebGL dans la page.
    const webgl = await page.evaluate(
      () =>
        [...document.querySelectorAll('canvas')].filter(
          (c) => c.getContext('webgl2') !== null || c.getContext('webgl') !== null,
        ).length,
    );
    expect(webgl).toBe(1);
    expect(erreurs).toEqual([]);
  });

  test('le spectre du visualiseur réagit au son pendant la lecture', async ({ page }) => {
    // Rendu WebGL logiciel + analyse de pixels : plus lent que les autres tests.
    test.setTimeout(90_000);
    await page.goto('./');
    await expect(page.locator('.visualiseur-canvas')).toBeVisible();
    // Compte les pixels de la couleur d'accent (barres du spectre) dans le canvas du visualiseur.
    const pixelsAccent = (): Promise<number> =>
      page.evaluate(() => {
        const canvas = document.querySelector('.visualiseur-canvas') as HTMLCanvasElement;
        const donnees = canvas
          .getContext('2d')
          ?.getImageData(0, 0, canvas.width, canvas.height).data;
        let total = 0;
        for (let i = 0; donnees !== undefined && i < donnees.length; i += 4) {
          const [r = 0, v = 0, b = 0] = [donnees[i], donnees[i + 1], donnees[i + 2]];
          if (r > 150 && v > 60 && v < 170 && b < 90) total += 1;
        }
        return total;
      });
    await page.waitForTimeout(1000);
    const repos = await pixelsAccent();
    await page.locator('.carte-corps button').first().click();
    let maximum = 0;
    for (let i = 0; i < 8; i += 1) {
      await page.waitForTimeout(500);
      maximum = Math.max(maximum, await pixelsAccent());
    }
    expect(maximum).toBeGreaterThan(repos * 1.3);
  });

  test('le texte repose sur le panneau semi-opaque, au-dessus du fond animé', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.fond-3d')).toHaveCount(1);
    const { fond, panneau, zIndex, evenements } = await page.evaluate(() => {
      const canvas = getComputedStyle(document.querySelector('canvas.fond-3d') as Element);
      return {
        fond: canvas.position,
        panneau: getComputedStyle(document.querySelector('main') as Element).backgroundColor,
        zIndex: canvas.zIndex,
        evenements: canvas.pointerEvents,
      };
    });
    expect(fond).toBe('fixed');
    expect(Number(zIndex)).toBeLessThan(0);
    expect(evenements).toBe('none');
    // Le panneau est partiellement transparent : couleur avec un canal alpha strictement entre 0 et 1.
    const alpha = /\/\s*([\d.]+)\s*\)|,\s*([\d.]+)\s*\)$/.exec(panneau);
    expect(Number(alpha?.[1] ?? alpha?.[2])).toBeGreaterThan(0.85);
    expect(Number(alpha?.[1] ?? alpha?.[2])).toBeLessThan(1);
  });

  test("la pochette de la page d'une piste passe en 3D", async ({ page }) => {
    await avecPochette(page);
    await page.goto('./');
    await page.locator('.carte-titre a').first().click();
    await expect(page.locator('.pochette-3d canvas')).toBeVisible();
    await expect(page.locator('.pochette-3d img')).toBeHidden();
    await expect(page.locator('.pochette-3d canvas')).toHaveAttribute('aria-hidden', 'true');
  });
});

test.describe('accessibilité avec le rendu 3D actif', () => {
  test.describe.configure({ mode: 'serial' });
  test.setTimeout(120_000);

  test('aucune violation axe (A, AA, AAA) avec fond animé, visualiseur et pochette 3D', async ({
    page,
  }) => {
    await avecPochette(page);
    await page.goto('./');
    await page.locator('.carte-titre a').first().click();
    await expect(page.locator('.pochette-3d canvas')).toBeVisible();
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
      // axe ne sait pas lire le contraste à travers un canvas : il est garanti par le panneau semi-opaque
      // et vérifié par scripts/verifier-contrastes.ts.
      .disableRules(['color-contrast-enhanced', 'color-contrast'])
      .analyze();
    expect(
      resultat.violations.map(
        (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
      ),
    ).toEqual([]);
  });
});

test.describe('mouvement réduit', () => {
  test.use({ reducedMotion: 'reduce' });

  test('aucun rendu 3D : fond statique, pas de visualiseur, pochette plane', async ({ page }) => {
    await avecPochette(page);
    await page.goto('./');
    await expect(page.locator('.carte').first()).toBeVisible();
    await page.waitForTimeout(800);
    await expect(page.locator('canvas.fond-3d')).toHaveCount(0);
    await expect(page.locator('.visualiseur')).toBeHidden();
    await page.locator('.carte-titre a').first().click();
    await expect(page.locator('.pochette-3d img')).toBeVisible();
    await expect(page.locator('.pochette-3d canvas')).toBeHidden();
  });
});

test.describe('sans WebGL', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (
        this: HTMLCanvasElement,
        type: string,
        ...reste: unknown[]
      ) {
        if (type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') return null;
        return (original as (...args: unknown[]) => unknown).call(this, type, ...reste);
      } as typeof original;
    });
  });

  test('repli : barre de niveau CSS, pochette plane, aucune erreur', async ({ page }) => {
    const erreurs: string[] = [];
    page.on('pageerror', (e) => erreurs.push(e.message));
    await avecPochette(page);
    await page.goto('./');
    await expect(page.locator('.niveau-css')).toBeVisible();
    await expect(page.locator('.visualiseur-canvas')).toBeHidden();
    await expect(page.locator('canvas.fond-3d')).toHaveCount(0);
    await page.locator('.carte-titre a').first().click();
    await expect(page.locator('.pochette-3d img')).toBeVisible();
    await expect(page.locator('.pochette-3d canvas')).toBeHidden();
    expect(erreurs).toEqual([]);
  });
});
