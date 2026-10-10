// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';
import { JETON_TEST, pngDeTest, simulerDepot } from './fixtures/github';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

const contenu = (page: Page) => page.locator('.admin-contenu');
const lignes = (page: Page) => page.locator('.admin-categories .admin-ligne');

async function ouvrir(page: Page): Promise<void> {
  await page.goto('./#/admin');
  await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON_TEST);
  await page.reload();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Administration sections' })
    .getByRole('button', { name: 'Categories' })
    .click();
}

const json = (fichier: { contenu: Buffer | null } | undefined): Record<string, unknown> =>
  JSON.parse(fichier?.contenu?.toString('utf8') ?? '{}') as Record<string, unknown>;

test.describe('liste des catégories', () => {
  test('affiche les catégories dans l’ordre du site avec leurs compteurs', async ({ page }) => {
    await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await expect(lignes(page)).toHaveCount(3);
    await expect(lignes(page).nth(0)).toContainText('Techno');
    await expect(lignes(page).nth(0)).toContainText('Rythmes rapides');
    await expect(lignes(page).nth(0)).toContainText('2 tracks');
    await expect(lignes(page).nth(0)).toContainText('1 album');
    await expect(lignes(page).nth(1)).toContainText('Ambiance');
    await expect(lignes(page).nth(2)).toContainText('Vide');
    await expect(lignes(page).nth(2)).toContainText('0 tracks');
  });

  test('réordonner et enregistrer l’ordre : seules les fiches qui changent sont écrites', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    const enregistrer = contenu(page).getByRole('button', { name: 'Save the order' });
    await expect(enregistrer).toBeDisabled();
    await contenu(page).getByRole('button', { name: 'Move up: Ambiance' }).click();
    await expect(lignes(page).nth(0)).toContainText('Ambiance');
    await expect(contenu(page).getByRole('button', { name: 'Move up: Ambiance' })).toBeDisabled();
    await expect(contenu(page).getByRole('button', { name: 'Move down: Ambiance' })).toBeFocused();
    await expect(enregistrer).toBeEnabled();
    await enregistrer.click();
    await expect(page.locator('.admin-succes')).toContainText('Order saved.');

    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: ordre des catégories');
    // La catégorie vide reste en 3e position : sa fiche, qui n'avait pas d'ordre, en reçoit un.
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      'public/musique/ambient/categorie.json',
      'public/musique/techno/categorie.json',
      'public/musique/vide/categorie.json',
    ]);
    expect(json(commit?.fichiers.find((f) => f.chemin.includes('ambient')))).toEqual({
      nom: 'Ambiance',
      couleur: '#ffcc00',
      ordre: 1,
    });
    expect(json(commit?.fichiers.find((f) => f.chemin.includes('techno')))['ordre']).toBe(2);
    expect(json(commit?.fichiers.find((f) => f.chemin.includes('vide')))).toEqual({
      nom: 'Vide',
      ordre: 3,
    });
  });
});

test.describe('création d’une catégorie', () => {
  test('crée le dossier avec sa fiche (couleur validée) et sa pochette', async ({ page }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'New category' }).click();
    await contenu(page).getByRole('textbox', { name: 'Name', exact: true }).fill('Drum & Bass');
    await expect(contenu(page).getByText('Folder: drum-bass')).toBeVisible();
    await contenu(page).getByRole('textbox', { name: 'Description' }).fill('Rapide');
    await contenu(page)
      .getByRole('textbox', { name: /^Color/ })
      .fill('#FFCC00');
    await expect(
      contenu(page).getByText(/Contrast with the site background: \d+\.\d:1/),
    ).toBeVisible();
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'c.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(contenu(page).getByText(/Cover ready/)).toBeVisible();
    await contenu(page).getByRole('button', { name: 'Save the category' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Category created.');

    const commit = depot.commits[0];
    expect(commit?.message).toBe('ajout: catégorie « Drum & Bass »');
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      'public/musique/drum-bass/categorie.json',
      'public/musique/drum-bass/cover.webp',
    ]);
    expect(json(commit?.fichiers.find((f) => f.chemin.endsWith('.json')))).toEqual({
      nom: 'Drum & Bass',
      description: 'Rapide',
      couleur: '#ffcc00',
    });
    // La liste a relu le dépôt.
    await expect(lignes(page).first()).toBeVisible();
  });

  test('refuse un nom vide, réservé ou déjà pris, et une couleur invalide ou trop sombre', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'New category' }).click();
    const nom = contenu(page).getByRole('textbox', { name: 'Name', exact: true });
    const couleur = contenu(page).getByRole('textbox', { name: /^Color/ });
    const enregistrer = contenu(page).getByRole('button', { name: 'Save the category' });
    const alerte = page.locator('.admin-formulaire > .erreur-champ');

    await enregistrer.click();
    await expect(alerte).toContainText('Enter a name.');
    await expect(nom).toHaveAttribute('aria-invalid', 'true');
    await expect(nom).toBeFocused();

    await nom.fill('Tout');
    await enregistrer.click();
    await expect(alerte).toContainText('reserved page name');

    await nom.fill('TECHNO');
    await enregistrer.click();
    await expect(alerte).toContainText('already exists');

    await nom.fill('Nouvelle');
    await couleur.fill('jaune');
    await enregistrer.click();
    await expect(alerte).toContainText('#RRGGBB');
    await expect(couleur).toHaveAttribute('aria-invalid', 'true');

    await couleur.fill('#111122');
    await expect(contenu(page).getByText(/⚠ Contrast with the site background/)).toBeVisible();
    await enregistrer.click();
    await expect(alerte).toContainText('at least 3:1 is required');
    expect(depot.commits).toHaveLength(0);

    await couleur.fill('#ffffff');
    await expect(contenu(page).getByText(/✓ Contrast with the site background/)).toBeVisible();
  });
});

test.describe('modification d’une catégorie', () => {
  test('renomme sans toucher au dossier : seule la fiche est écrite, avec l’ordre conservé', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Edit : Ambiance' }).click();
    await expect(contenu(page).getByRole('textbox', { name: 'Name', exact: true })).toHaveValue(
      'Ambiance',
    );
    await expect(contenu(page).getByRole('textbox', { name: /^Color/ })).toHaveValue('#ffcc00');
    await expect(contenu(page).getByText('Folder: ambient')).toBeVisible();
    await expect(contenu(page).getByText(/Renaming changes the displayed name only/)).toBeVisible();

    await contenu(page)
      .getByRole('textbox', { name: 'Name', exact: true })
      .fill('Ambiances douces');
    await contenu(page).getByRole('textbox', { name: 'Description' }).fill('Pour se poser');
    await contenu(page).getByRole('button', { name: 'Save the category' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();

    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: catégorie « Ambiances douces »');
    expect(commit?.fichiers.map((f) => f.chemin)).toEqual([
      'public/musique/ambient/categorie.json',
    ]);
    expect(json(commit?.fichiers[0])).toEqual({
      nom: 'Ambiances douces',
      description: 'Pour se poser',
      couleur: '#ffcc00',
      ordre: 2,
    });
  });

  test('sans changement, rien n’est publié', async ({ page }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Edit : Techno' }).click();
    await contenu(page).getByRole('button', { name: 'Save the category' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('une nouvelle pochette remplace l’ancienne', async ({ page }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Edit : Ambiance' }).click();
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'c.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(contenu(page).getByText(/Cover ready/)).toBeVisible();
    await contenu(page).getByRole('button', { name: 'Save the category' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    // Même extension WebP : l'image est écrasée sur place, la fiche ne change pas.
    expect(depot.commits[0]?.fichiers.map((f) => f.chemin)).toEqual([
      'public/musique/ambient/cover.webp',
    ]);
  });
});

test.describe('suppression d’une catégorie', () => {
  test('une catégorie vide est supprimée après confirmation', async ({ page }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Delete : Vide' }).click();
    await expect(page.getByRole('dialog')).toContainText('Delete the empty category “Vide”?');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Category deleted.');
    expect(depot.commits[0]?.message).toBe('suppression: catégorie « Vide »');
    expect(depot.commits[0]?.fichiers).toEqual([
      { chemin: 'public/musique/vide/categorie.json', contenu: null, sha: null },
    ]);
  });

  test('une catégorie non vide déplace son contenu vers la catégorie choisie, sans rien renvoyer', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Delete : Ambiance' }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toContainText('contains 3 files');
    await dialogue.getByRole('radio', { name: 'vide' }).check();
    await dialogue.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('.admin-succes')).toContainText('Category deleted.');

    const commit = depot.commits[0];
    expect(commit?.message).toBe('suppression: catégorie « Ambiance » (contenu déplacé vers vide)');
    const parChemin = new Map(commit?.fichiers.map((f) => [f.chemin, f]));
    expect(parChemin.get('public/musique/vide/brume.mp3')?.sha).toBe('m-brume');
    expect(parChemin.get('public/musique/vide/brume.json')?.sha).toBe('f-brume');
    expect(parChemin.get('public/musique/vide/brume.webp')?.sha).toBe('i-brume');
    expect(parChemin.get('public/musique/ambient/brume.mp3')?.sha).toBeNull();
    // Fiche et pochette de la catégorie : supprimées, pas déplacées.
    expect(parChemin.get('public/musique/ambient/categorie.json')?.sha).toBeNull();
    expect(parChemin.get('public/musique/ambient/cover.webp')?.sha).toBeNull();
    expect([...parChemin.keys()].some((c) => c.startsWith('public/musique/vide/categorie'))).toBe(
      false,
    );
  });

  test('Annuler ne supprime rien', async ({ page }) => {
    const depot = await simulerDepot(page, { categories: true });
    await ouvrir(page);
    await contenu(page).getByRole('button', { name: 'Delete : Ambiance' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(depot.commits).toHaveLength(0);
  });
});

test('aucune violation axe (WCAG AAA) : liste, formulaire, boîte de suppression', async ({
  page,
}) => {
  await simulerDepot(page, { categories: true });
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

  await ouvrir(page);
  await expect(lignes(page)).toHaveCount(3);
  expect(await violations()).toEqual([]);

  await contenu(page).getByRole('button', { name: 'Delete : Ambiance' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await violations()).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await contenu(page).getByRole('button', { name: 'Edit : Ambiance' }).click();
  await expect(contenu(page).getByRole('textbox', { name: 'Name', exact: true })).toBeVisible();
  expect(await violations()).toEqual([]);
});
