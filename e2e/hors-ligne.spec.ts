// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, test, type Page } from '@playwright/test';

// Seul fichier où le service worker est autorisé (voir playwright.config.ts) ; vrai catalogue, sans simulation.
test.use({ serviceWorkers: 'allow', reducedMotion: 'reduce' });

/** Attend que le service worker soit installé, actif et qu'il contrôle la page. */
async function attendreServiceWorker(page: Page): Promise<void> {
  await page.evaluate(async () => {
    await navigator.serviceWorker.ready;
  });
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
}

test("le service worker précharge la coquille de l'application", async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await attendreServiceWorker(page);

  const {
    portee,
    caches: noms,
    urls,
  } = await page.evaluate(async () => {
    const enregistrement = await navigator.serviceWorker.ready;
    const noms = await caches.keys();
    const cache = await caches.open(noms[0] ?? '');
    return {
      portee: enregistrement.scope,
      caches: noms,
      urls: (await cache.keys()).map((r) => new URL(r.url).pathname),
    };
  });
  expect(portee).toMatch(/\/Ap3X\/$/);
  expect(noms.filter((n) => n.startsWith('ap3x-'))).toHaveLength(1);
  expect(urls).toContain('/Ap3X/');
  expect(urls).toContain('/Ap3X/index.html');
  expect(urls).toContain('/Ap3X/catalogue.json');
  expect(urls).toContain('/Ap3X/manifest.webmanifest');
  expect(urls.some((u) => /^\/Ap3X\/assets\/index-.+\.js$/.test(u))).toBe(true);
  // Ni l'audio, ni les fiches de musique ne sont préchargés.
  expect(urls.some((u) => u.includes('/musique/'))).toBe(false);
});

test("l'application se recharge et se parcourt sans réseau, catalogue compris", async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await attendreServiceWorker(page);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('heading', { level: 1, name: 'AP3X Records' })).toBeVisible();
  // Le catalogue vient du cache : les pistes s'affichent.
  await expect(page.locator('.carte').first()).toBeVisible();
  await expect(page.locator('.carte-titre a').first()).toHaveText('300');

  await page.getByRole('link', { name: 'Licenses' }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Licenses' })).toBeVisible();
  await page.getByRole('link', { name: 'Home' }).click();
  await page.locator('.carte-titre a').first().click();
  await expect(page).toHaveURL(/#\/piste\/techno--300$/);
  await expect(page.getByRole('heading', { level: 1, name: '300' })).toBeVisible();
  await context.setOffline(false);
});

test('hors ligne, la lecture signale que la piste est indisponible au lieu de planter', async ({
  page,
  context,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await attendreServiceWorker(page);
  await context.setOffline(true);
  await page.reload();
  await page.locator('.carte').first().getByRole('button', { name: /^Play/ }).click();
  await expect(page.locator('.lecteur-erreur')).toHaveText('This track cannot be played.', {
    timeout: 20_000,
  });
  await context.setOffline(false);
});

test("l'audio n'est jamais mis en cache", async ({ page }) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await attendreServiceWorker(page);
  await page.locator('.carte').first().getByRole('button', { name: /^Play/ }).click();
  await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Pause');
  await page.waitForTimeout(1000);
  const enCache = await page.evaluate(async () => {
    const reponse = await caches.match(new Request('/Ap3X/musique/techno/300.mp3'));
    return reponse !== undefined;
  });
  expect(enCache).toBe(false);
});

test("une réponse d'erreur du serveur n'est jamais mise en cache", async ({ page, context }) => {
  // `vite preview` répond 200 à tout chemin inconnu (repli SPA) : on simule le 404 que renvoie GitHub Pages,
  // sur les requêtes du service worker lui-même.
  await context.route('**/pochettes/inexistante.webp', (route) =>
    route.fulfill({ status: 404, body: 'absent' }),
  );
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await attendreServiceWorker(page);
  const { statut, enCache } = await page.evaluate(async () => {
    const reponse = await fetch('/Ap3X/pochettes/inexistante.webp');
    const trouvee = await caches.match(new Request('/Ap3X/pochettes/inexistante.webp'));
    return { statut: reponse.status, enCache: trouvee !== undefined };
  });
  expect(statut).toBe(404);
  expect(enCache).toBe(false);
});

test('sw.js est servi avec sa version et la liste des fichiers à précharger', async ({
  request,
}) => {
  const reponse = await request.get('./sw.js');
  expect(reponse.status()).toBe(200);
  expect(reponse.headers()['content-type']).toMatch(/javascript/);
  const code = await reponse.text();
  expect(code).toMatch(/ap3x-/);
  expect(code).toContain('/Ap3X/index.html');
  expect(code).toContain('SPDX-License-Identifier: GPL-3.0-or-later');
});

test('le manifeste décrit une application installable', async ({ request }) => {
  const reponse = await request.get('./manifest.webmanifest');
  expect(reponse.status()).toBe(200);
  const manifeste = (await reponse.json()) as {
    name: string;
    start_url: string;
    display: string;
    background_color: string;
    theme_color: string;
    icons: { src: string; sizes: string; type: string; purpose?: string }[];
  };
  expect(manifeste).toMatchObject({ name: 'AP3X Records', display: 'standalone', start_url: './' });
  expect(manifeste.icons.some((i) => i.sizes === '192x192' && i.purpose === 'any')).toBe(true);
  expect(manifeste.icons.some((i) => i.sizes === '512x512' && i.purpose === 'any')).toBe(true);
  expect(manifeste.icons.some((i) => i.purpose === 'maskable')).toBe(true);
  // Chaque icône existe et fait bien la taille annoncée (largeur et hauteur dans l'en-tête PNG).
  for (const icone of manifeste.icons.filter((i) => i.type === 'image/png')) {
    const image = await request.get(icone.src);
    expect(image.status(), icone.src).toBe(200);
    const octets = await image.body();
    const taille = `${octets.readUInt32BE(16)}x${octets.readUInt32BE(20)}`;
    expect(taille, icone.src).toBe(icone.sizes);
  }
});
