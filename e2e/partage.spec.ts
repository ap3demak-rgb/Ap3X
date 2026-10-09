// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { unzipSync } from 'fflate';
import { servirCatalogueTest } from './fixtures/catalogue';

// Ces parcours ne concernent pas le rendu 3D : mouvement réduit = pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

const ORIGINE = 'http://localhost:4173';

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

const lireJeton = (page: Page) => page.locator('.lecteur-titre');
test.describe("ouverture directe d'une page de piste", () => {
  test('la waveform est dessinée même quand la page lance la lecture pendant sa construction', async ({
    page,
  }) => {
    await page.goto('./#/piste/rock-roll--mon-album--r3');
    await expect(page.locator('.onde-grande')).toBeVisible();
    await expect
      .poll(() =>
        page.evaluate(() => {
          const canvas = document.querySelector('.onde-grande canvas') as HTMLCanvasElement;
          const donnees = canvas
            .getContext('2d')
            ?.getImageData(0, 0, canvas.width, canvas.height).data;
          let pixels = 0;
          for (let i = 3; donnees !== undefined && i < donnees.length; i += 4) {
            if ((donnees[i] ?? 0) > 0) pixels += 1;
          }
          return pixels;
        }),
      )
      .toBeGreaterThan(500);
  });
});

test.describe('copier le lien', () => {
  test.beforeEach(async ({ context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: ORIGINE });
  });
  const presse = (page: Page): Promise<string> =>
    page.evaluate(() => navigator.clipboard.readText());

  test("copie le lien de la page de partage d'une piste et l'annonce", async ({ page }) => {
    await page.goto('./#/piste/rock-roll--mon-album--r1');
    await page.getByRole('button', { name: 'Copy link : Alpha' }).click();
    expect(await presse(page)).toBe(`${ORIGINE}/Ap3X/partage/piste/rock-roll--mon-album--r1/`);
    await expect(page.locator('.partage-retour')).toHaveText('Link copied.');
    await expect(page.locator('.annonceur')).toContainText('Link copied.', { timeout: 8000 });
  });

  test("« Démarrer à » ajoute l'instant courant au lien, et n'est proposé qu'en cours de lecture", async ({
    page,
  }) => {
    await page.goto('./#/piste/ambient--a1');
    const caseInstant = page.getByRole('checkbox', { name: /Start at/ });
    await expect(caseInstant).toBeDisabled();
    await expect(caseInstant).toHaveAccessibleName('Start at 0:00');

    await page.getByRole('button', { name: 'Play : Brume – AP3X Records' }).click();
    await expect(lireJeton(page)).toHaveText('Brume');
    await page.locator('.onde-grande .onde-curseur').fill('95');
    await expect(caseInstant).toBeEnabled();
    await caseInstant.check();
    await page.getByRole('button', { name: 'Pause' }).click();
    await page.getByRole('button', { name: 'Copy link : Brume' }).click();
    expect(await presse(page)).toMatch(
      new RegExp(`^${ORIGINE}/Ap3X/partage/piste/ambient--a1/\\?t=1m3[5-9]s$`),
    );

    // Case décochée : lien sans instant.
    await caseInstant.uncheck();
    await page.getByRole('button', { name: 'Copy link : Brume' }).click();
    expect(await presse(page)).toBe(`${ORIGINE}/Ap3X/partage/piste/ambient--a1/`);
  });

  test("copie le lien d'un album, sans option d'instant", async ({ page }) => {
    await page.goto('./#/album/rock-roll--mon-album');
    await expect(page.getByRole('checkbox', { name: /Start at/ })).toHaveCount(0);
    await page.getByRole('button', { name: 'Copy link : Mon Album' }).click();
    expect(await presse(page)).toBe(`${ORIGINE}/Ap3X/partage/album/rock-roll--mon-album/`);
  });

  test("signale l'échec quand le presse-papiers est refusé", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', {
        value: { writeText: () => Promise.reject(new Error('refusé')) },
      });
      document.execCommand = () => false;
    });
    await page.goto('./#/piste/ambient--a1');
    await page.getByRole('button', { name: 'Copy link : Brume' }).click();
    await expect(page.locator('.partage-retour')).toHaveText('Unable to copy the link.');
  });
});

test.describe('pages statiques générées au build', () => {
  test("la page de partage d'une piste porte les balises Open Graph et redirige vers l'application", async ({
    page,
    request,
  }) => {
    const reponse = await request.get('./partage/piste/techno--300/');
    expect(reponse.status()).toBe(200);
    const html = await reponse.text();
    expect(html).toContain('<meta property="og:type" content="music.song" />');
    expect(html).toContain('<meta property="og:title" content="300 – AP3X Records" />');
    expect(html).toContain('og:image');
    expect(html).toMatch(
      /<link rel="canonical" href="https:\/\/[^"]+\/partage\/piste\/techno--300\/" \/>/,
    );

    // Cette piste n'existe que dans le vrai catalogue, pas dans celui de test.
    await page.unroute('**/catalogue.json');
    await page.goto('./partage/piste/techno--300/?t=30');
    await expect(page).toHaveURL(/\/Ap3X\/#\/piste\/techno--300\?t=30$/);
    await expect(page.getByRole('heading', { level: 1, name: '300' })).toBeVisible();
  });

  test("la page d'accueil porte ses balises Open Graph et sa description", async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute(
      'content',
      'AP3X Records',
    );
    await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
      'content',
      /^https:\/\/.+\/icones\/icone-512\.png$/,
    );
    await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute('content', 'summary');
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      'content',
      /Creative Commons/,
    );
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /^https:\/\/.+\/$/);
  });

  test("404.html redirige immédiatement vers l'accueil", async ({ page }) => {
    await page.goto('./404.html');
    await expect(page).toHaveURL(/\/Ap3X\/$/);
    await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
  });

  test('le plan du site et robots.txt listent les pages de partage', async ({ request }) => {
    const plan = await (await request.get('./sitemap.xml')).text();
    expect(plan).toContain('/partage/piste/techno--300/</loc>');
    const robots = await (await request.get('./robots.txt')).text();
    expect(robots).toMatch(/Sitemap: https:\/\/.+\/sitemap\.xml/);
  });
});

test.describe('téléchargements', () => {
  test("le lien de téléchargement d'une piste n'apparaît que si la piste l'autorise", async ({
    page,
  }) => {
    await page.goto('./#/piste/rock-roll--mon-album--r3');
    const lien = page.getByRole('link', { name: 'Download MP3' });
    await expect(lien).toBeVisible();
    await expect(lien).toHaveAttribute('download', '');
    await expect(lien).toHaveAttribute('href', '/Ap3X/musique/techno/300.mp3');
    await page.goto('./#/piste/rock-roll--mon-album--r1');
    await expect(page.getByRole('heading', { level: 1, name: 'Alpha' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Download MP3' })).toHaveCount(0);
  });

  test('un album autorisé se télécharge en ZIP avec ses pistes, une licence et une progression', async ({
    page,
  }) => {
    await page.goto('./#/album/rock-roll--mon-album');
    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download album (ZIP) : Mon Album' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toBe('AP3X Records - Mon Album.zip');
    const flux = await fichier.createReadStream();
    const morceaux: Buffer[] = [];
    for await (const morceau of flux) morceaux.push(morceau as Buffer);
    const entrees = unzipSync(new Uint8Array(Buffer.concat(morceaux)));
    const dossier = 'AP3X Records - Mon Album';
    // Album sur deux disques : numérotation « disque-piste ».
    expect(Object.keys(entrees).sort()).toEqual([
      `${dossier}/1-01 - Alpha.mp3`,
      `${dossier}/1-02 - Beta.mp3`,
      `${dossier}/2-01 - Gamma.mp3`,
      `${dossier}/LICENSE.txt`,
    ]);
    const mp3 = readFileSync('public/musique/techno/300.mp3');
    expect(Buffer.from(entrees[`${dossier}/1-01 - Alpha.mp3`] ?? []).equals(mp3)).toBe(true);
    const licence = new TextDecoder().decode(entrees[`${dossier}/LICENSE.txt`]);
    expect(licence).toContain('© 2024 AP3X Records');
    expect(licence).toContain('License: CC BY-NC-ND 4.0');
    expect(licence).toContain('Catalogue reference: AP3X-001');
    await expect(page.getByText('Album downloaded.')).toBeVisible();
    await expect(page.getByRole('button', { name: /Download album/ })).toBeEnabled();
  });

  test("un album non autorisé n'a pas de bouton ZIP", async ({ page }) => {
    await page.goto('./#/album/techno--single-x');
    await expect(page.getByRole('heading', { level: 1, name: 'Single X' })).toBeVisible();
    await expect(page.getByRole('button', { name: /Download album/ })).toHaveCount(0);
  });

  test("signale l'échec du téléchargement d'un album", async ({ page }) => {
    await page.route('**/musique/techno/300.mp3', (route) => route.fulfill({ status: 500 }));
    await page.goto('./#/album/rock-roll--mon-album');
    await page.getByRole('button', { name: 'Download album (ZIP) : Mon Album' }).click();
    await expect(
      page.getByRole('alert').filter({ hasText: 'The album download failed.' }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Download album/ })).toBeEnabled();
  });
});

test.describe('accessibilité (axe, WCAG AAA)', () => {
  for (const [nom, adresse] of [
    ['piste avec partage', './#/piste/rock-roll--mon-album--r3'],
    ['album avec partage et ZIP', './#/album/rock-roll--mon-album'],
  ] as const) {
    test(`aucune violation : ${nom}`, async ({ page }) => {
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
});
