// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { servirCatalogueTest } from './fixtures/catalogue';

// Ces parcours ne concernent pas le rendu 3D : mouvement réduit = pas de WebGL, tests plus rapides.
test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await servirCatalogueTest(page);
});

const titres = (page: Page, section: string): Promise<string[]> =>
  page
    .locator(`section:has(> h2:text-is("${section}")) .carte-titre`)
    .allTextContents()
    .then((valeurs) => valeurs.map((v) => v.trim()));

const champRecherche = (page: Page) => page.getByRole('searchbox', { name: 'Search' });
const panneau = (page: Page) => page.locator('#resultats-recherche');
const annonce = (page: Page) => page.locator('.annonceur');

async function accueil(page: Page): Promise<void> {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
}

test.describe('recherche', () => {
  test('affiche les résultats en temps réel, groupés par type', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('zenith');
    await expect(panneau(page)).toBeVisible();
    await expect(panneau(page).getByRole('heading', { name: 'Tracks' })).toBeVisible();
    await expect(panneau(page).getByRole('link', { name: 'Zenith – DJ X' })).toBeVisible();

    await champRecherche(page).fill('dj');
    await expect(panneau(page).getByRole('heading', { name: 'Artists' })).toBeVisible();
    await expect(panneau(page).getByRole('link', { name: 'DJ X', exact: true })).toBeVisible();

    await champRecherche(page).fill('#nuit');
    await expect(panneau(page).getByRole('heading', { name: 'Hashtags' })).toBeVisible();
    await expect(panneau(page).getByRole('link', { name: '#nuit' })).toBeVisible();

    await champRecherche(page).fill('techno');
    await expect(panneau(page).getByRole('heading', { name: 'Categories' })).toBeVisible();
    await expect(panneau(page).getByRole('link', { name: 'Techno' })).toBeVisible();
  });

  test('ignore les accents et la casse, dans la requête comme dans les titres', async ({
    page,
  }) => {
    await accueil(page);
    await champRecherche(page).fill('MÖN ÁLBUM');
    await expect(
      panneau(page).getByRole('link', { name: 'Mon Album – AP3X Records' }),
    ).toBeVisible();
    await champRecherche(page).fill('ap3x-001');
    await expect(
      panneau(page).getByRole('link', { name: 'Mon Album – AP3X Records' }),
    ).toBeVisible();
  });

  test("annonce le nombre de résultats et un message quand il n'y en a aucun", async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('zzzzzz');
    await expect(panneau(page)).toContainText('No result for “zzzzzz”.');
    await expect(page.locator('form[role=search] [role=status]')).toHaveText('Results: 0');
    await champRecherche(page).fill('night');
    await expect(page.locator('form[role=search] [role=status]')).not.toHaveText('Results: 0');
    await champRecherche(page).fill('');
    await expect(panneau(page)).toBeHidden();
  });

  test('se parcourt au clavier : flèches, Entrée sur un résultat, Échap', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('night');
    await champRecherche(page).press('ArrowDown');
    await expect(panneau(page).getByRole('link').first()).toBeFocused();
    await page.keyboard.press('ArrowUp');
    await expect(champRecherche(page)).toBeFocused();
    await champRecherche(page).press('Escape');
    await expect(panneau(page)).toBeHidden();
    await expect(champRecherche(page)).toBeFocused();

    await champRecherche(page).fill('night');
    await champRecherche(page).press('ArrowDown');
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/#\/piste\/techno--t2$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Night Drive' })).toBeVisible();
  });

  test('se referme quand le focus ou le clic quitte la recherche', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('zenith');
    await expect(panneau(page)).toBeVisible();
    // Clic dans la marge de la page, hors du panneau de résultats qui recouvre le titre.
    await page.locator('main').click({ position: { x: 4, y: 4 } });
    await expect(panneau(page)).toBeHidden();
  });

  test('Entrée ouvre la page des résultats complets', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('demo');
    await champRecherche(page).press('Enter');
    await expect(page).toHaveURL(/#\/recherche\/demo$/);
    await expect(page.getByRole('heading', { level: 1, name: 'Results for “demo”' })).toBeVisible();
    expect((await titres(page, 'Tracks')).sort()).toEqual(['Beta', 'Night Drive']);
    await expect(page).toHaveTitle(/Results for “demo” – AP3X Records/);

    await page.goto('./#/recherche/rien%20du%20tout');
    await expect(page.getByText('No result for “rien du tout”.')).toBeVisible();
  });

  test('« Voir tous les résultats » mène à la page complète', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('album');
    await panneau(page).getByRole('link', { name: 'See all results' }).click();
    await expect(page).toHaveURL(/#\/recherche\/album$/);
    expect(await titres(page, 'Albums')).toEqual(['Mon Album']);
  });

  test("la page d'un artiste liste ses albums et ses pistes", async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('dj');
    await panneau(page).getByRole('link', { name: 'DJ X', exact: true }).click();
    await expect(page).toHaveURL(/#\/artiste\/DJ%20X$/);
    await expect(page.getByRole('heading', { level: 1, name: 'DJ X' })).toBeVisible();
    expect(await titres(page, 'Albums')).toEqual(['Single X']);
    expect(await titres(page, 'Tracks')).toEqual(['Zenith']);

    await page.goto('./#/piste/techno--single-x--t1');
    await page.locator('.fiche-artiste').getByRole('link', { name: 'DJ X' }).click();
    await expect(page).toHaveURL(/#\/artiste\/DJ%20X$/);

    await page.goto('./#/artiste/Inconnu');
    await expect(page.locator('main').getByRole('alert')).toHaveText('Artist not found.');
  });
});

test.describe("favoris d'albums et file d'attente", () => {
  test('un album aimé apparaît sur la page Favoris avec ses pistes, et persiste', async ({
    page,
  }) => {
    await page.goto('./#/albums');
    await page.getByRole('button', { name: 'Add to favorites : Single X' }).click();
    await expect(
      page.getByRole('button', { name: 'Remove from favorites : Single X' }),
    ).toBeVisible();

    await page.goto('./#/piste/ambient--a1');
    await page.getByRole('button', { name: 'Add to favorites : Brume' }).click();

    await page.goto('./#/categorie/favoris');
    expect(await titres(page, 'Albums')).toEqual(['Single X']);
    expect(await titres(page, 'Tracks')).toEqual(['Brume']);
    await page.reload();
    expect(await titres(page, 'Albums')).toEqual(['Single X']);

    // « Tout lire » : les pistes des albums d'abord.
    await page.getByRole('button', { name: /Play all/ }).click();
    await expect(page.locator('.lecteur-titre')).toHaveText('Zenith');

    await page.getByRole('button', { name: 'Remove from favorites : Single X' }).click();
    expect(await titres(page, 'Albums')).toEqual([]);
    expect(await titres(page, 'Tracks')).toEqual(['Brume']);
    await page.getByRole('button', { name: 'Remove from favorites : Brume' }).click();
    await expect(page.getByText('You have not liked any track or album yet.')).toBeVisible();
  });

  test('la page Catégories compte les albums favoris', async ({ page }) => {
    await page.goto('./#/albums');
    await page.getByRole('button', { name: 'Add to favorites : Mon Album' }).click();
    await page.goto('./#/categories');
    await expect(
      page.locator('.liste-categories-grande li').filter({ hasText: 'Favorites' }),
    ).toContainText('1 album');
  });

  test("un album entier s'ajoute à la file d'attente, avec une annonce", async ({ page }) => {
    await page.goto('./#/album/rock-roll--mon-album');
    await page.getByRole('button', { name: 'Add to queue : Mon Album' }).click();
    await expect(annonce(page)).toContainText('Added to the queue : Mon Album', { timeout: 8000 });
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    const file = page.locator('.lecteur-file li');
    await expect(file).toHaveCount(3);
    await expect(file.nth(0)).toContainText('Alpha');
    await expect(file.nth(2)).toContainText('Gamma');
    // Les pistes ajoutées à une file vide ne démarrent pas toutes seules.
    await expect(page.locator('.lecteur-lecture')).toHaveAttribute('aria-label', 'Play');
  });

  test("depuis une carte d'album, « Ajouter à la file » ajoute toutes ses pistes", async ({
    page,
  }) => {
    await page.goto('./#/albums');
    await page.getByRole('button', { name: 'Add to queue : Mon Album' }).click();
    await page.getByRole('button', { name: 'Queue', exact: true }).click();
    await expect(page.locator('.lecteur-file li')).toHaveCount(3);
  });
});

/** Ouvre la boîte « Ajouter à une playlist » pour une piste ou un album. */
async function ouvrirChoix(page: Page, titre: string): Promise<void> {
  await page
    .getByRole('button', { name: `Add to a playlist : ${titre}` })
    .first()
    .click();
  await expect(page.getByRole('dialog', { name: `Choose a playlist : ${titre}` })).toBeVisible();
}

async function creerDepuisChoix(page: Page, titre: string, nom: string): Promise<void> {
  await ouvrirChoix(page, titre);
  await page.getByRole('dialog').getByLabel('New playlist').fill(nom);
  await page.getByRole('dialog').getByRole('button', { name: 'Create playlist' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

test.describe('playlists', () => {
  test('création depuis une piste, ajout à une playlist existante et sans doublon', async ({
    page,
  }) => {
    await page.goto('./#/categorie/tout');
    await creerDepuisChoix(page, 'Brume', 'Route');
    await expect(annonce(page)).toContainText('Playlist “Route” created.', { timeout: 8000 });

    await ouvrirChoix(page, 'Night Drive');
    await page.getByRole('dialog').getByRole('button', { name: 'Route' }).click();
    await expect(annonce(page)).toContainText('Added to “Route”.', { timeout: 8000 });

    await ouvrirChoix(page, 'Night Drive');
    await page.getByRole('dialog').getByRole('button', { name: 'Route' }).click();
    await expect(annonce(page)).toContainText('Already in “Route”.', { timeout: 8000 });

    await page.goto('./#/playlists');
    const element = page.locator('.liste-categories-grande li').filter({ hasText: 'Route' });
    await expect(element).toContainText('2 tracks');
  });

  test("un album entier s'ajoute à une playlist", async ({ page }) => {
    await page.goto('./#/album/rock-roll--mon-album');
    await creerDepuisChoix(page, 'Mon Album', 'Album complet');
    await page.goto('./#/playlists');
    await expect(
      page.locator('.liste-categories-grande li').filter({ hasText: 'Album complet' }),
    ).toContainText('3 tracks');
  });

  test('la boîte de dialogue se ferme avec Échap et rend le focus au bouton', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1');
    await ouvrirChoix(page, 'Brume');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Add to a playlist : Brume' })).toBeFocused();
  });

  test('refuse un nom vide, dans la boîte de dialogue comme sur la page', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1');
    await ouvrirChoix(page, 'Brume');
    await page.getByRole('dialog').getByRole('button', { name: 'Create playlist' }).click();
    await expect(page.getByRole('dialog').getByRole('alert')).toHaveText(
      'Enter a name for the playlist.',
    );
    await page.keyboard.press('Escape');

    await page.goto('./#/playlists');
    await page.getByRole('button', { name: 'Create playlist' }).click();
    await expect(page.locator('main').getByRole('alert').first()).toHaveText(
      'Enter a name for the playlist.',
    );
    await expect(page.getByText('You have no playlist yet.')).toBeVisible();
  });

  test('créer depuis la page Playlists, ouvrir, renommer, réordonner, retirer et lire', async ({
    page,
  }) => {
    await page.goto('./#/playlists');
    await page.getByLabel('Playlist name').fill('  Ma   sélection ');
    await page.getByRole('button', { name: 'Create playlist' }).click();
    await expect(annonce(page)).toContainText('Playlist “Ma sélection” created.', {
      timeout: 8000,
    });
    await expect(page.getByText('You have no playlist yet.')).toHaveCount(0);

    // Trois pistes via la boîte de dialogue.
    for (const titre of ['Brume', 'Night Drive', 'Zenith']) {
      // L'accueil montre toutes les pistes, y compris celles qui sont dans un album.
      await page.goto('./');
      await ouvrirChoix(page, titre);
      await page.getByRole('dialog').getByRole('button', { name: 'Ma sélection' }).click();
    }

    await page.goto('./#/playlists');
    await page.getByRole('link', { name: 'Ma sélection' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Ma sélection' })).toBeVisible();
    const lignes = page.locator('ol.liste-titres li');
    await expect(lignes).toHaveCount(3);
    const noms = async (): Promise<string[]> =>
      (await lignes.locator('.titre-nom a:first-child').allTextContents()).map((v) => v.trim());
    expect(await noms()).toEqual(['Brume', 'Night Drive', 'Zenith']);

    // Réordonner : le focus suit le bouton déplacé.
    await page.getByRole('button', { name: 'Move up : Zenith' }).click();
    expect(await noms()).toEqual(['Brume', 'Zenith', 'Night Drive']);
    await expect(page.getByRole('button', { name: 'Move up : Zenith' })).toBeFocused();
    await page.getByRole('button', { name: 'Move down : Brume' }).click();
    expect(await noms()).toEqual(['Zenith', 'Brume', 'Night Drive']);
    await expect(page.getByRole('button', { name: 'Move up : Zenith' })).toBeDisabled();

    // Retirer.
    await page.getByRole('button', { name: 'Remove from playlist : Brume' }).click();
    expect(await noms()).toEqual(['Zenith', 'Night Drive']);

    // Lire : la file reprend l'ordre de la playlist.
    await page.getByRole('button', { name: 'Play all : Ma sélection' }).click();
    await expect(page.locator('.lecteur-titre')).toHaveText('Zenith');

    // Renommer.
    await page.getByLabel('Playlist name').fill('Soirée');
    await page.getByRole('button', { name: 'Rename : Ma sélection' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Soirée' })).toBeVisible();
    await expect(page).toHaveTitle('Soirée – AP3X Records');
    await expect(annonce(page)).toContainText('Playlist renamed.', { timeout: 8000 });

    // Persistance.
    await page.reload();
    await expect(page.getByRole('heading', { level: 1, name: 'Soirée' })).toBeVisible();
    expect(await noms()).toEqual(['Zenith', 'Night Drive']);
  });

  test('la suppression demande confirmation et peut être annulée', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1');
    await creerDepuisChoix(page, 'Brume', 'Éphémère');
    await page.goto('./#/playlists');
    await page.getByRole('link', { name: 'Éphémère' }).click();

    await page.getByRole('button', { name: 'Delete playlist : Éphémère' }).click();
    await expect(page.getByRole('dialog', { name: 'Delete playlist' })).toBeVisible();
    await expect(page.getByText('Delete the playlist “Éphémère”?')).toBeVisible();
    // Le focus initial est sur « Annuler » : une validation accidentelle ne supprime rien.
    await expect(page.getByRole('dialog').getByRole('button', { name: 'Cancel' })).toBeFocused();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Éphémère' })).toBeVisible();

    await page.getByRole('button', { name: 'Delete playlist : Éphémère' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page).toHaveURL(/#\/playlists$/);
    await expect(page.getByText('You have no playlist yet.')).toBeVisible();
    await expect(annonce(page)).toContainText('Playlist “Éphémère” deleted.', { timeout: 8000 });
  });

  test('une playlist inconnue affiche un message', async ({ page }) => {
    await page.goto('./#/playlist/inconnue');
    await expect(page.locator('main').getByRole('alert')).toHaveText('Playlist not found.');
  });

  test('exporte puis importe les playlists en JSON', async ({ page }) => {
    await page.goto('./#/piste/ambient--a1');
    await creerDepuisChoix(page, 'Brume', 'Route');
    await page.goto('./#/playlists');

    const telechargement = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export playlists' }).click();
    const fichier = await telechargement;
    expect(fichier.suggestedFilename()).toBe('playlists-ap3x.json');
    const flux = await fichier.createReadStream();
    const morceaux: Buffer[] = [];
    for await (const morceau of flux) morceaux.push(morceau as Buffer);
    const contenu = JSON.parse(Buffer.concat(morceaux).toString('utf8')) as {
      format: string;
      version: number;
      playlists: { nom: string; pistes: string[] }[];
    };
    expect(contenu.format).toBe('ap3x-playlists');
    expect(contenu.playlists.map((p) => ({ nom: p.nom, pistes: p.pistes }))).toEqual([
      { nom: 'Route', pistes: ['ambient--a1'] },
    ]);

    // Importer le même fichier : la playlist existante n'est pas écrasée.
    await page.getByLabel('Import playlists').setInputFiles({
      name: 'export.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(contenu)),
    });
    await expect(
      page.getByRole('status').filter({ hasText: 'Playlists imported: 1' }),
    ).toBeVisible();
    await expect(page.locator('.liste-categories-grande li')).toHaveCount(2);
    await expect(page.getByRole('link', { name: 'Route (2)' })).toBeVisible();

    // Un fichier invalide est refusé sans rien modifier.
    await page.getByLabel('Import playlists').setInputFiles({
      name: 'mauvais.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"autre"}'),
    });
    await expect(
      page.getByRole('alert').filter({ hasText: 'This file is not a valid playlists export.' }),
    ).toBeVisible();
    await expect(page.locator('.liste-categories-grande li')).toHaveCount(2);
  });

  test("l'export est désactivé tant qu'il n'y a aucune playlist", async ({ page }) => {
    await page.goto('./#/playlists');
    await expect(page.getByRole('button', { name: 'Export playlists' })).toBeDisabled();
    await page.getByLabel('Playlist name').fill('A');
    await page.getByRole('button', { name: 'Create playlist' }).click();
    await expect(page.getByRole('button', { name: 'Export playlists' })).toBeEnabled();
  });

  test('un nom déjà pris reçoit un suffixe', async ({ page }) => {
    await page.goto('./#/playlists');
    for (let i = 0; i < 2; i += 1) {
      await page.getByLabel('Playlist name').fill('Mix');
      await page.getByRole('button', { name: 'Create playlist' }).click();
    }
    await expect(page.getByRole('link', { name: 'Mix', exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Mix (2)' })).toBeVisible();
  });
});

const ETIQUETTES = [
  'wcag2a',
  'wcag2aa',
  'wcag2aaa',
  'wcag21a',
  'wcag21aa',
  'wcag22aa',
  'best-practice',
];

async function violations(page: Page): Promise<string[]> {
  const resultat = await new AxeBuilder({ page }).withTags(ETIQUETTES).analyze();
  return resultat.violations.map(
    (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
  );
}

test.describe('accessibilité (axe, WCAG AAA)', () => {
  test("page de résultats, page d'un artiste", async ({ page }) => {
    await page.goto('./#/recherche/demo');
    await expect(page.locator('main h1')).toBeVisible();
    await page.waitForLoadState('networkidle');
    expect(await violations(page)).toEqual([]);
    await page.goto('./#/artiste/DJ%20X');
    await expect(page.locator('main h1')).toBeVisible();
    expect(await violations(page)).toEqual([]);
  });

  test("page Playlists et page d'une playlist remplies", async ({ page }) => {
    await page.goto('./#/categorie/tout');
    await creerDepuisChoix(page, 'Brume', 'Route');
    await page.goto('./#/playlists');
    await expect(page.getByRole('link', { name: 'Route' })).toBeVisible();
    expect(await violations(page)).toEqual([]);
    await page.getByRole('link', { name: 'Route' }).click();
    await expect(page.locator('ol.liste-titres li')).toHaveCount(1);
    expect(await violations(page)).toEqual([]);
  });

  test('panneau de recherche ouvert et boîte de dialogue ouverte', async ({ page }) => {
    await accueil(page);
    await champRecherche(page).fill('a');
    await expect(panneau(page)).toBeVisible();
    expect(await violations(page)).toEqual([]);
    // Clic dans la marge de la page, hors du panneau de résultats qui recouvre le titre.
    await page.locator('main').click({ position: { x: 4, y: 4 } });

    await ouvrirChoix(page, 'Brume');
    expect(await violations(page)).toEqual([]);
  });
});
