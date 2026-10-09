// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';

test.use({ reducedMotion: 'reduce' });

const LANGUES = ['fr', 'de', 'ja', 'es', 'ru', 'vi', 'zh', 'ko'] as const;
const PAGES = ['./', './#/albums', './#/licences'] as const;
const ETIQUETTES = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

for (const langue of LANGUES) {
  test(`axe (WCAG AAA) et attribut lang en « ${langue} » sur l’accueil, les albums et les licences`, async ({
    page,
  }) => {
    await refuserLectureAutomatique(page);
    await page.addInitScript((code) => localStorage.setItem('ap3x.langue', code), langue);
    for (const adresse of PAGES) {
      await page.goto(adresse);
      await expect(page.locator('main h1')).toBeVisible();
      await expect(page.locator('html')).toHaveAttribute('lang', langue);
      await page.waitForLoadState('networkidle');
      const resultat = await new AxeBuilder({ page }).withTags(ETIQUETTES).analyze();
      expect(
        resultat.violations.map(
          (v) =>
            `${adresse} ${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
        ),
      ).toEqual([]);
    }
  });
}
