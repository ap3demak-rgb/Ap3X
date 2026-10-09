// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

// Les audits statiques tournent en mouvement réduit : le rendu WebGL logiciel des serveurs de test
// monopolise le processeur et empêche axe de terminer. Le rendu 3D actif a son propre audit
// (e2e/rendu3d.spec.ts).
test.use({ reducedMotion: 'reduce' });

const ETIQUETTES = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

const PAGES = [
  ['accueil', './'],
  ['albums', './#/albums'],
  ['licences', './#/licences'],
] as const;

for (const [nom, adresse] of PAGES) {
  test(`aucune violation axe (WCAG AAA) sur la page ${nom}`, async ({ page }) => {
    await page.goto(adresse);
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    const resultat = await new AxeBuilder({ page }).withTags(ETIQUETTES).analyze();
    expect(
      resultat.violations.map(
        (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
      ),
    ).toEqual([]);
  });
}

test("aucune violation axe sur la page d'une piste, lecture en cours", async ({ page }) => {
  await page.goto('./');
  await page.locator('.carte-titre a').first().click();
  await expect(page.locator('.onde-grande')).toBeVisible();
  await page
    .getByRole('button', { name: /^(Play|Lecture)/ })
    .first()
    .click();
  await page.waitForTimeout(800);
  const resultat = await new AxeBuilder({ page }).withTags(ETIQUETTES).analyze();
  expect(
    resultat.violations.map(
      (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
    ),
  ).toEqual([]);
});

test("la tabulation atteint le bouton de lecture d'une carte dans un ordre logique, et Entrée la lance", async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  const parcours: string[] = [];
  for (let i = 0; i < 20; i += 1) {
    await page.keyboard.press('Tab');
    const decrit = await page.evaluate(() => {
      const e = document.activeElement;
      return e === null
        ? ''
        : `${e.tagName.toLowerCase()}:${e.getAttribute('aria-label') ?? e.textContent?.trim() ?? ''}`;
    });
    parcours.push(decrit);
    if (/^button:(Play|Lecture) :/.test(decrit)) break;
  }
  const indexLecture = parcours.findIndex((d) => /^button:(Play|Lecture) :/.test(d));
  expect(indexLecture, parcours.join(' > ')).toBeGreaterThan(0);
  // Évitement du contenu, puis en-tête, puis contenu, dans cet ordre.
  expect(parcours[0]).toMatch(/^button:/);
  expect(parcours.findIndex((d) => d.startsWith('select:') || d.startsWith('a:'))).toBeGreaterThan(
    0,
  );
  await page.keyboard.press('Enter');
  await expect(page.locator('.lecteur-titre')).not.toHaveText('');
  await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', /Pause/);
});

test('toutes les commandes visibles font au moins 44 × 44 px', async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  const trop_petites = await page.evaluate(() => {
    const resultat: string[] = [];
    for (const e of document.querySelectorAll<HTMLElement>('button, select, input[type=range]')) {
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) continue;
      const style = getComputedStyle(e);
      if (style.position === 'absolute' && r.left < 0) continue;
      const estOnde = e.classList.contains('onde-curseur');
      if (r.height < 43.5 || (!estOnde && r.width < 43.5)) {
        resultat.push(
          `${e.tagName.toLowerCase()}.${e.className} ${Math.round(r.width)}×${Math.round(r.height)}`,
        );
      }
    }
    return resultat;
  });
  expect(trop_petites).toEqual([]);
});

test.describe('texte agrandi à 200 %', () => {
  for (const [nom, adresse] of PAGES) {
    test(`aucun débordement horizontal sur la page ${nom}`, async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 720 });
      await page.goto(adresse);
      await expect(page.locator('main h1')).toBeVisible();
      await page.addStyleTag({ content: 'html { font-size: 200% !important; }' });
      await page.waitForTimeout(300);
      const { debordement, hauteurLecteur } = await page.evaluate(() => ({
        debordement: document.documentElement.scrollWidth - window.innerWidth,
        hauteurLecteur:
          (document.querySelector('.lecteur') as HTMLElement).offsetHeight / window.innerHeight,
      }));
      expect(debordement).toBeLessThanOrEqual(1);
      // La barre fixe ne doit pas occuper la majeure partie de l'écran.
      expect(hauteurLecteur).toBeLessThan(0.5);
    });
  }
});
