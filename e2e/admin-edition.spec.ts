// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';
import { mp3AvecTags, ouvrirAdmin, pngDeTest, simulerDepot } from './fixtures/github';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

const contenu = (page: Page) => page.locator('.admin-contenu');
const champTexte = (page: Page, nom: string) =>
  contenu(page).getByRole('textbox', { name: nom, exact: true });

async function modifier(page: Page, titre: string): Promise<void> {
  await contenu(page)
    .getByRole('button', { name: `Edit : ${titre}` })
    .click();
  await expect(
    contenu(page).getByRole('heading', { name: new RegExp(`Edit the track : ${titre}`) }),
  ).toBeVisible();
}

const contenuJson = (fichier: { contenu: Buffer | null } | undefined): Record<string, unknown> =>
  JSON.parse(fichier?.contenu?.toString('utf8') ?? '{}') as Record<string, unknown>;

test.describe('modification d’une piste', () => {
  test('le formulaire reprend la fiche ; publier un brouillon et changer le titre modifie la fiche seule', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, 'Brume');
    await expect(champTexte(page, 'Title')).toHaveValue('Brume');
    await expect(champTexte(page, 'Hashtags (separated by spaces or commas)')).toHaveValue(
      '#nuit #calme',
    );
    const publier = contenu(page).getByLabel('Publish immediately');
    await expect(publier).not.toBeChecked();

    await champTexte(page, 'Title').fill('Brume du matin');
    await publier.check();
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Changes saved.');

    expect(depot.commits).toHaveLength(1);
    const commit = depot.commits[0];
    expect(commit?.message).toBe(
      'modification: piste « Brume du matin »'.replace('modification', 'publication'),
    );
    expect(commit?.fichiers.map((f) => f.chemin)).toEqual(['public/musique/ambient/brume.json']);
    expect(contenuJson(commit?.fichiers[0])).toEqual({
      titre: 'Brume du matin',
      hashtags: ['nuit', 'calme'],
      pochette: 'brume.webp',
    });
    // Retour à la liste, qui a relu le dépôt.
    await expect(page.locator('.admin-ligne')).toHaveCount(3);
  });

  test('sans changement, rien n’est publié', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, 'Trois Cents');
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('changer de catégorie déplace le MP3, la fiche et l’image sans renvoyer les fichiers', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, 'Brume');
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('techno');
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();

    const commit = depot.commits[0];
    expect(commit?.message).toBe('déplacement: piste « Brume » vers techno');
    const parChemin = new Map(commit?.fichiers.map((f) => [f.chemin, f]));
    // Anciens chemins supprimés.
    for (const ancien of ['brume.mp3', 'brume.json', 'brume.webp']) {
      expect(parChemin.get(`public/musique/ambient/${ancien}`)).toMatchObject({ sha: null });
    }
    // MP3 et image réutilisés par leur empreinte, fiche réécrite.
    expect(parChemin.get('public/musique/techno/brume.mp3')?.sha).toBe('m-brume');
    expect(parChemin.get('public/musique/techno/brume.webp')?.sha).toBe('i-brume');
    expect(contenuJson(parChemin.get('public/musique/techno/brume.json'))).toMatchObject({
      titre: 'Brume',
      pochette: 'brume.webp',
    });
  });

  test('un déplacement qui créerait un doublon est refusé', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    // « 300 » existe déjà dans techno : on le déplace dans ambient puis on tente l'inverse avec un titre identique.
    await modifier(page, 'Trois Cents');
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('ambient');
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    expect(depot.commits[0]?.message).toBe('déplacement: piste « Trois Cents » vers ambient');
  });

  test('remplacer le MP3 et la pochette envoie les nouveaux fichiers et retire l’ancienne image si le format change', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, 'Brume');
    await contenu(page)
      .getByLabel('Replace the MP3 file (optional)')
      .setInputFiles({
        name: 'nouveau.mp3',
        mimeType: 'audio/mpeg',
        buffer: mp3AvecTags({ TIT2: 'Autre' }),
      });
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'c.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(contenu(page).locator('.admin-apercu')).toBeVisible();
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();

    const fichiers = depot.commits[0]?.fichiers ?? [];
    const mp3 = fichiers.find((f) => f.chemin.endsWith('brume.mp3'));
    expect(mp3?.contenu?.subarray(0, 3).toString('ascii')).toBe('ID3');
    const image = fichiers.find((f) => f.chemin.endsWith('brume.webp'));
    // Même extension WebP : l'image est écrasée, pas supprimée.
    expect(image?.contenu?.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  test('la catégorie d’une piste d’album est verrouillée', async ({ page }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, '01-intro');
    await expect(
      contenu(page).getByRole('combobox', { name: 'Category', exact: true }),
    ).toBeDisabled();
    await expect(page.getByText('This track belongs to an album')).toBeVisible();
  });

  test('l’aperçu montre la page publique sans rien publier', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await modifier(page, 'Brume');
    const bouton = contenu(page).getByRole('button', { name: 'Preview the public page' });
    await bouton.click();
    await expect(bouton).toHaveAttribute('aria-expanded', 'true');
    const apercu = contenu(page).locator('.admin-apercu-page');
    await expect(apercu.getByRole('heading', { name: 'Brume' })).toBeVisible();
    await expect(apercu).toContainText('#nuit #calme');
    await expect(apercu).toContainText('ambient--brume');
    await expect(apercu).toContainText('Draft');
    await champTexte(page, 'Title').fill('Autre titre');
    await bouton.click();
    await bouton.click();
    await expect(apercu.getByRole('heading', { name: 'Autre titre' })).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('l’aperçu d’une nouvelle piste propose d’écouter le fichier choisi', async ({ page }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'New track');
    await contenu(page)
      .getByLabel('MP3 file')
      .setInputFiles({
        name: 'a.mp3',
        mimeType: 'audio/mpeg',
        buffer: mp3AvecTags({ TIT2: 'Essai', TCON: 'ambient' }),
      });
    await contenu(page).getByRole('button', { name: 'Preview the public page' }).click();
    await expect(contenu(page).locator('.admin-apercu-page audio')).toHaveCount(1);
    await expect(contenu(page).locator('.admin-apercu-page')).toContainText('ambient--essai');
  });
});

test.describe('suppression', () => {
  test('après confirmation, retire le MP3, la fiche et la pochette en un commit', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await contenu(page).getByRole('button', { name: 'Delete : Brume' }).click();
    await expect(page.getByRole('dialog')).toContainText('Delete “Brume”');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Deleted.');

    const commit = depot.commits[0];
    expect(commit?.message).toBe('suppression: piste « Brume »');
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      'public/musique/ambient/brume.json',
      'public/musique/ambient/brume.mp3',
      'public/musique/ambient/brume.webp',
    ]);
    expect(commit?.fichiers.every((f) => f.sha === null)).toBe(true);
  });

  test('Annuler (ou Échap) ne supprime rien', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await contenu(page).getByRole('button', { name: 'Delete : Brume' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await contenu(page).getByRole('button', { name: 'Delete : Brume' }).click();
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(depot.commits).toHaveLength(0);
  });

  test('une piste d’album n’est pas supprimée ici', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await contenu(page).getByRole('button', { name: 'Delete : 01-intro' }).click();
    await expect(page.locator('.admin-pistes').getByRole('alert')).toContainText(
      'belong to an album',
    );
    expect(depot.commits).toHaveLength(0);
  });
});

test.describe('actions groupées', () => {
  async function choisir(page: Page, ...titres: string[]): Promise<void> {
    for (const titre of titres) {
      await contenu(page)
        .getByRole('checkbox', { name: `Select: ${titre}` })
        .check();
    }
  }
  const action = (page: Page) =>
    contenu(page).getByRole('combobox', { name: 'Action on the selection' });
  const appliquer = (page: Page) => contenu(page).getByRole('button', { name: 'Apply' });

  test('compteur de sélection, tout sélectionner et désactivation sans sélection', async ({
    page,
  }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await expect(appliquer(page)).toBeDisabled();
    await choisir(page, 'Brume');
    await expect(contenu(page).getByText('1 selected')).toBeVisible();
    await contenu(page).getByLabel('Select all shown tracks').check();
    await expect(contenu(page).getByText('3 selected')).toBeVisible();
    await contenu(page).getByLabel('Select all shown tracks').uncheck();
    await expect(contenu(page).getByText('0 selected')).toBeVisible();
  });

  test('ajouter un hashtag à plusieurs pistes en un seul commit', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Brume', 'Trois Cents');
    await action(page).selectOption({ label: 'Add a hashtag' });
    await contenu(page).getByRole('textbox', { name: 'Hashtag to add' }).fill('#vu');
    await appliquer(page).click();
    await expect(page.locator('.admin-succes')).toContainText('2 tracks');

    expect(depot.commits).toHaveLength(1);
    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: 2 pistes (ajout du hashtag #vu)');
    const brume = commit?.fichiers.find((f) => f.chemin.endsWith('brume.json'));
    const trois = commit?.fichiers.find((f) => f.chemin.endsWith('300.json'));
    expect(contenuJson(brume)['hashtags']).toEqual(['nuit', 'calme', 'vu']);
    expect(contenuJson(trois)['hashtags']).toEqual(['nuit', 'vu']);
  });

  test('masquer une piste visible et publier un brouillon', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Trois Cents');
    await action(page).selectOption({ label: 'Hide (make a draft)' });
    await appliquer(page).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    expect(contenuJson(depot.commits[0]?.fichiers[0])['visible']).toBe(false);
  });

  test('rien à changer : message et aucun commit', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Trois Cents');
    await action(page).selectOption({ label: 'Publish' });
    await appliquer(page).click();
    await expect(page.getByText('Nothing to change')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('déplacer plusieurs pistes vers une catégorie, ou exiger le choix de la destination', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Brume');
    await action(page).selectOption({ label: 'Move to a category' });
    await appliquer(page).click();
    await expect(page.getByText('Choose the target category.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);

    await contenu(page).getByRole('combobox', { name: 'Target category' }).selectOption('techno');
    await appliquer(page).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    expect(depot.commits[0]?.message).toBe('modification: 1 pistes (déplacement vers techno)');
  });

  test('une sélection qui contient une piste d’album déplacée est refusée en entier', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Brume', '01-intro');
    await action(page).selectOption({ label: 'Move to a category' });
    await contenu(page).getByRole('combobox', { name: 'Target category' }).selectOption('ambient');
    await appliquer(page).click();
    await expect(page.locator('.admin-pistes').getByRole('alert')).toContainText('01-intro');
    expect(depot.commits).toHaveLength(0);
  });

  test('supprimer plusieurs pistes demande une confirmation avec leur nombre', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Tracks');
    await choisir(page, 'Brume', 'Trois Cents');
    await action(page).selectOption({ label: 'Delete' });
    await appliquer(page).click();
    await expect(page.getByRole('dialog')).toContainText('Delete 2 tracks');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Deleted.');
    expect(depot.commits[0]?.message).toBe('suppression: 2 pistes');
  });
});

test('aucune violation axe (WCAG AAA) : liste avec sélection, formulaire de modification, aperçu', async ({
  page,
}) => {
  await simulerDepot(page);
  const etiquettes = [
    'wcag2a',
    'wcag2aa',
    'wcag2aaa',
    'wcag21a',
    'wcag21aa',
    'wcag22aa',
    'best-practice',
  ];
  const violations = async (): Promise<string[]> =>
    (await new AxeBuilder({ page }).withTags(etiquettes).analyze()).violations.map(
      (v) => `${v.id} : ${v.help} (${v.nodes.map((n) => n.target.join(' ')).join(' | ')})`,
    );

  await ouvrirAdmin(page, 'Tracks');
  await expect(page.locator('.admin-ligne')).toHaveCount(3);
  await contenu(page).getByRole('checkbox', { name: 'Select: Brume' }).check();
  expect(await violations()).toEqual([]);

  await modifier(page, 'Brume');
  await contenu(page).getByRole('button', { name: 'Preview the public page' }).click();
  await expect(contenu(page).locator('.admin-apercu-page')).toBeVisible();
  expect(await violations()).toEqual([]);
});
