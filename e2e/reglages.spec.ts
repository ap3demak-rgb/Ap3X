// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test, type Page } from '@playwright/test';
import { servirCatalogueTest } from './fixtures/catalogue';

/**
 * Les réglages du site sont insérés dans index.html au build. Ces tests réécrivent cette balise à la volée
 * pour vérifier l'effet de chaque réglage sans reconstruire le site.
 */
async function avecReglages(page: Page, modifications: Record<string, unknown>): Promise<void> {
  await page.route(
    (url) => url.pathname === '/Ap3X/' || url.pathname === '/Ap3X/index.html',
    async (route) => {
      const reponse = await route.fetch();
      const html = await reponse.text();
      const balise = /(<script type="application\/json" id="reglages-site">)([^<]*)(<\/script>)/;
      const actuel = JSON.parse(balise.exec(html)?.[2] ?? '{}') as Record<string, unknown>;
      const fusion = fusionner(actuel, modifications);
      const json = JSON.stringify(fusion).replaceAll('<', '\\u003c');
      await route.fulfill({ response: reponse, body: html.replace(balise, `$1${json}$3`) });
    },
  );
}

function fusionner(
  a: Record<string, unknown>,
  b: Record<string, unknown>,
): Record<string, unknown> {
  const sortie = { ...a };
  for (const [cle, valeur] of Object.entries(b)) {
    const base = sortie[cle];
    sortie[cle] =
      typeof valeur === 'object' &&
      valeur !== null &&
      !Array.isArray(valeur) &&
      typeof base === 'object' &&
      base !== null
        ? fusionner(base as Record<string, unknown>, valeur as Record<string, unknown>)
        : valeur;
  }
  return sortie;
}

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

test.describe('identité et pied de page', () => {
  test('le nom et le slogan du site remplacent ceux d’origine', async ({ page }) => {
    await avecReglages(page, { nom: 'Label Test', slogan: 'Du son libre <b>pour tous</b>' });
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1, name: 'Label Test' })).toBeVisible();
    // Le slogan est du texte, jamais du HTML.
    await expect(page.locator('.slogan')).toHaveText('Du son libre <b>pour tous</b>');
    await expect(page.locator('.slogan b')).toHaveCount(0);
    await expect(page).toHaveTitle('Label Test');
    await expect(page.locator('header .marque')).toContainText('Label Test');
  });

  test('sans slogan, aucun paragraphe vide n’est ajouté', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('.slogan')).toHaveCount(0);
  });

  test('les liens du pied de page s’ouvrent avec rel noopener, sauf mailto', async ({ page }) => {
    await avecReglages(page, {
      liens: [
        { nom: 'Bandcamp', url: 'https://exemple.org/label' },
        { nom: 'Écrire', url: 'mailto:salut@exemple.org' },
        { nom: 'Piège', url: 'javascript:alert(1)' },
      ],
    });
    await page.goto('./');
    const liens = page.locator('footer .pied-liens a');
    await expect(liens).toHaveCount(2);
    await expect(liens.nth(0)).toHaveAttribute('href', 'https://exemple.org/label');
    await expect(liens.nth(0)).toHaveAttribute('rel', /noopener/);
    await expect(liens.nth(1)).toHaveAttribute('href', 'mailto:salut@exemple.org');
  });
});

test.describe('menu et accueil', () => {
  test('les entrées masquées disparaissent du menu', async ({ page }) => {
    await page.goto('./');
    const menu = page.getByRole('navigation', { name: 'Main' });
    await expect(menu.getByRole('link', { name: 'Albums' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Licenses' })).toBeVisible();
  });

  test('masquer des entrées les retire, les autres restent', async ({ page }) => {
    await avecReglages(page, { menu: { masques: ['albums', 'licences', 'playlists'] } });
    await page.goto('./');
    const menu = page.locator('header nav');
    await expect(menu.getByRole('link', { name: 'Home' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Categories' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Albums' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Licenses' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Playlists' })).toHaveCount(0);
  });

  test('les pistes et albums mis en avant ouvrent la page ; un identifiant inconnu est ignoré', async ({
    page,
  }) => {
    await avecReglages(page, {
      accueil: { misesEnAvant: ['techno--single-x', 'inconnu--x', 'ambient--a1'] },
    });
    await page.goto('./');
    const vedettes = page.getByRole('heading', { level: 2, name: 'Featured' }).locator('xpath=..');
    await expect(vedettes.locator('.carte')).toHaveCount(2);
    await expect(vedettes.locator('.carte').nth(0)).toContainText('Single X');
    await expect(vedettes.locator('.carte').nth(1)).toContainText('Brume');
    // La section arrive avant les dernières pistes.
    const titres = await page.locator('main h2').allTextContents();
    expect(titres[0]).toBe('Featured');
  });

  test('sans mise en avant, pas de section « Featured »', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('.carte').first()).toBeVisible();
    await expect(page.getByRole('heading', { level: 2, name: 'Featured' })).toHaveCount(0);
  });
});

test.describe('options', () => {
  test('l’interrupteur de téléchargements masque le ZIP d’un album autorisé', async ({ page }) => {
    await page.goto('./#/album/rock-roll--mon-album');
    await expect(
      page.getByRole('button', { name: 'Download album (ZIP) : Mon Album' }),
    ).toBeVisible();

    const autre = await page.context().newPage();
    await servirCatalogueTest(autre);
    await avecReglages(autre, { options: { telechargements: false } });
    await autre.goto('./#/album/rock-roll--mon-album');
    await expect(autre.getByRole('heading', { level: 1, name: 'Mon Album' })).toBeVisible();
    await expect(autre.getByRole('button', { name: /Download album/ })).toHaveCount(0);
  });

  test('la lecture aléatoire par défaut est active pour un nouveau visiteur', async ({ page }) => {
    await avecReglages(page, { options: { aleatoire: true } });
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Shuffle' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  test('sans réglage, la lecture aléatoire est désactivée', async ({ page }) => {
    await page.goto('./');
    await expect(page.getByRole('button', { name: 'Shuffle' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
  });
});

test.describe('fond animé', () => {
  test('désactivé, aucun fond 3D n’est créé même sans mouvement réduit', async ({ page }) => {
    await avecReglages(page, { fond: { actif: false } });
    await page.goto('./');
    await expect(page.locator('.carte').first()).toBeVisible();
    // Le rendu 3D démarre quelques secondes après le chargement : on attend plus longtemps que ce délai.
    await page.waitForTimeout(5000);
    await expect(page.locator('canvas.fond-3d')).toHaveCount(0);
    await expect(page.locator('.visualiseur')).toBeHidden();
  });

  test('actif, le fond 3D apparaît', async ({ page }) => {
    await page.goto('./');
    await expect(page.locator('canvas.fond-3d')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.visualiseur')).toBeVisible();
  });

  test('sans visualiseur, le fond reste animé mais le bandeau est caché', async ({ page }) => {
    await avecReglages(page, { fond: { visualiseur: false } });
    await page.goto('./');
    await expect(page.locator('canvas.fond-3d')).toHaveCount(1, { timeout: 20_000 });
    await expect(page.locator('.visualiseur')).toBeHidden();
  });
});

test('un réglage illisible dans la page n’empêche pas le site de démarrer', async ({ page }) => {
  const erreurs: string[] = [];
  page.on('pageerror', (e) => erreurs.push(e.message));
  await page.route(
    (url) => url.pathname === '/Ap3X/',
    async (route) => {
      const reponse = await route.fetch();
      const html = (await reponse.text()).replace(
        /(<script type="application\/json" id="reglages-site">)[^<]*(<\/script>)/,
        '$1{pas du json$2',
      );
      await route.fulfill({ response: reponse, body: html });
    },
  );
  await page.goto('./');
  await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
  expect(erreurs).toEqual([]);
});
