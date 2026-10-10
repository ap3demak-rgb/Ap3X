// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';
import { ouvrirAdmin, REGLAGES_DEPOT, simulerDepot } from './fixtures/github';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

const contenu = (page: Page) => page.locator('.admin-contenu');
const alerte = (page: Page) => page.locator('.admin-formulaire > .erreur-champ');
const json = (fichier: { contenu: Buffer | null } | undefined): Record<string, unknown> =>
  JSON.parse(fichier?.contenu?.toString('utf8') ?? '{}') as Record<string, unknown>;

test.describe('réglages du site', () => {
  test('le formulaire reprend les réglages du dépôt', async ({ page }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    await expect(contenu(page).getByRole('textbox', { name: 'Site name' })).toHaveValue(
      'AP3X Records',
    );
    await expect(contenu(page).getByRole('textbox', { name: /^Description/ })).toHaveValue(
      'Listen to AP3X Records.',
    );
    await expect(contenu(page).getByLabel(/^Allow downloads/)).toBeChecked();
    await expect(contenu(page).getByLabel(/^Shuffle on by default/)).not.toBeChecked();
    await expect(contenu(page).getByLabel('Animated 3D background')).toBeChecked();
    await expect(contenu(page).getByLabel('Intensity')).toHaveValue('1');
  });

  test('enregistre nom, slogan, liens, options, accueil, fond et menu dans site.json', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    await contenu(page).getByRole('textbox', { name: 'Site name' }).fill('Label Test');
    await contenu(page)
      .getByRole('textbox', { name: /^Tagline/ })
      .fill('Du son libre');
    await contenu(page).getByRole('button', { name: 'Add a link' }).click();
    await contenu(page).getByRole('textbox', { name: 'Link name' }).fill('Bandcamp');
    await contenu(page)
      .getByRole('textbox', { name: /^Address/ })
      .fill('https://exemple.org/label');
    await contenu(page)
      .getByLabel(/^Allow downloads/)
      .uncheck();
    await contenu(page)
      .getByLabel(/^Shuffle on by default/)
      .check();
    await contenu(page)
      .getByRole('textbox', { name: /^Featured tracks/ })
      .fill('ambient--brume\n\n  techno--300  \nrien--du-tout');
    await contenu(page).getByLabel('Animated 3D background').uncheck();
    await contenu(page).getByLabel('Speed').fill('2');
    await contenu(page).getByLabel('Audio visualizer band').uncheck();
    await contenu(page)
      .getByRole('group', { name: 'Hide these menu entries' })
      .getByLabel('Albums')
      .check();
    await contenu(page).getByRole('button', { name: 'Save the settings' }).click();

    await expect(page.locator('.admin-succes')).toContainText('Settings saved.');
    // Un identifiant inconnu est signalé sans bloquer l'enregistrement.
    await expect(page.locator('.admin-succes')).toContainText('rien--du-tout');
    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: réglages du site');
    expect(commit?.fichiers.map((f) => f.chemin)).toEqual(['public/site.json']);
    expect(json(commit?.fichiers[0])).toEqual({
      version: 1,
      nom: 'Label Test',
      slogan: 'Du son libre',
      description: 'Listen to AP3X Records.',
      liens: [{ nom: 'Bandcamp', url: 'https://exemple.org/label' }],
      options: { telechargements: false, aleatoire: true },
      accueil: { misesEnAvant: ['ambient--brume', 'techno--300', 'rien--du-tout'] },
      fond: { actif: false, intensite: 1, vitesse: 2, visualiseur: false },
      menu: { masques: ['albums'] },
    });
    expect(commit?.fichiers[0]?.contenu?.toString('utf8').endsWith('\n')).toBe(true);
  });

  test('refuse un lien dangereux ou un nom vide, en indiquant le champ', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    await contenu(page).getByRole('textbox', { name: 'Site name' }).fill('   ');
    await contenu(page).getByRole('button', { name: 'Add a link' }).click();
    await contenu(page).getByRole('textbox', { name: 'Link name' }).fill('Piège');
    await contenu(page)
      .getByRole('textbox', { name: /^Address/ })
      .fill('javascript:alert(1)');
    await contenu(page).getByRole('button', { name: 'Save the settings' }).click();
    await expect(alerte(page)).toContainText('“Site name” is not valid.');
    await expect(alerte(page)).toContainText('“Links shown in the footer” is not valid.');
    await expect(contenu(page).getByRole('textbox', { name: 'Site name' })).toHaveAttribute(
      'aria-invalid',
      'true',
    );
    await expect(contenu(page).getByRole('textbox', { name: 'Site name' })).toBeFocused();
    expect(depot.commits).toHaveLength(0);
  });

  test('sans changement, rien n’est publié ; une ligne de lien vide est ignorée', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    await contenu(page).getByRole('button', { name: 'Add a link' }).click();
    await contenu(page).getByRole('button', { name: 'Save the settings' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
    expect(REGLAGES_DEPOT.liens).toEqual([]);
  });

  test('un lien peut être retiré avant l’enregistrement', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    await contenu(page).getByRole('button', { name: 'Add a link' }).click();
    await contenu(page).getByRole('textbox', { name: 'Link name' }).fill('A');
    await contenu(page)
      .getByRole('textbox', { name: /^Address/ })
      .fill('https://a.fr');
    await contenu(page)
      .getByRole('button', { name: /^Remove the link/ })
      .click();
    await expect(contenu(page).getByRole('textbox', { name: 'Link name' })).toHaveCount(0);
    await contenu(page).getByRole('button', { name: 'Save the settings' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('avertit avant de quitter la page avec des modifications', async ({ page }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'Site');
    const sans = await page.evaluate(() => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(sans).toBe(false);
    await contenu(page).getByRole('textbox', { name: 'Site name' }).fill('Autre');
    const avec = await page.evaluate(() => {
      const e = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(e);
      return e.defaultPrevented;
    });
    expect(avec).toBe(true);
  });
});

test.describe('éditeur JSON', () => {
  async function choisir(page: Page, chemin: string): Promise<void> {
    await contenu(page).getByRole('combobox', { name: 'File' }).selectOption(chemin);
  }
  const zone = (page: Page) => contenu(page).getByRole('textbox', { name: 'Content of the file' });

  test('liste les fichiers de configuration du dépôt', async ({ page }) => {
    await simulerDepot(page, { categories: true });
    await ouvrirAdmin(page, 'JSON');
    const options = await contenu(page)
      .getByRole('combobox', { name: 'File' })
      .locator('option')
      .allTextContents();
    expect(options).toEqual(
      expect.arrayContaining([
        'public/site.json',
        'public/manifest.webmanifest',
        'public/musique/ambient/categorie.json',
        'public/musique/ambient/brume.json',
      ]),
    );
    expect(options).not.toContain('package.json');
  });

  test('valide en direct, bloque l’enregistrement tant que le texte est invalide, puis enregistre', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrirAdmin(page, 'JSON');
    await choisir(page, 'public/site.json');
    await expect(zone(page)).toHaveValue(/"nom": "AP3X Records"/);
    await expect(page.getByText('Valid JSON that matches the schema.')).toBeVisible();
    const enregistrer = contenu(page).getByRole('button', { name: 'Save the file' });
    await expect(enregistrer).toBeDisabled();

    await zone(page).fill('{ "version": 1,');
    await expect(page.getByText(/^Not valid:/)).toBeVisible();
    await expect(zone(page)).toHaveAttribute('aria-invalid', 'true');
    await expect(enregistrer).toBeDisabled();

    await zone(page).fill('{"version":1,"nom":""}');
    await expect(page.getByText(/Not valid: .*nom/)).toBeVisible();
    await expect(enregistrer).toBeDisabled();

    await zone(page).fill(JSON.stringify({ ...REGLAGES_DEPOT, nom: 'Nom JSON' }, null, 2));
    await expect(page.getByText('Valid JSON that matches the schema.')).toBeVisible();
    await expect(enregistrer).toBeEnabled();
    await enregistrer.click();
    await expect(page.locator('.admin-succes')).toContainText('File saved.');
    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: public/site.json');
    expect(json(commit?.fichiers[0])['nom']).toBe('Nom JSON');
    expect(commit?.fichiers[0]?.contenu?.toString('utf8').endsWith('\n')).toBe(true);
  });

  test('applique le schéma du type : fiche de catégorie et fiche de piste', async ({ page }) => {
    await simulerDepot(page, { categories: true });
    await ouvrirAdmin(page, 'JSON');
    await choisir(page, 'public/musique/ambient/categorie.json');
    await zone(page).fill('{"nom":"A","ordre":0}');
    await expect(page.getByText(/Not valid: .*ordre/)).toBeVisible();
    await zone(page).fill('{"nom":"A","ordre":3}');
    await expect(page.getByText('Valid JSON that matches the schema.')).toBeVisible();

    await choisir(page, 'public/musique/ambient/brume.json');
    await expect(zone(page)).toHaveValue(/"titre":"Brume"/);
    await zone(page).fill('{"titre":"Brume","champ_inconnu":1}');
    await expect(page.getByText(/Not valid:/)).toBeVisible();
  });

  test('le manifeste n’est contrôlé que comme objet JSON', async ({ page }) => {
    await simulerDepot(page);
    await ouvrirAdmin(page, 'JSON');
    await choisir(page, 'public/manifest.webmanifest');
    await zone(page).fill('{"name":"Autre","display":"standalone"}');
    await expect(page.getByText('Valid JSON that matches the schema.')).toBeVisible();
    await zone(page).fill('[1,2]');
    await expect(page.getByText(/Not valid:/)).toBeVisible();
  });
});

test.describe('historique et retour en arrière', () => {
  test('liste les derniers commits ; la fusion n’est pas annulable', async ({ page }) => {
    await simulerDepot(page, { historique: true });
    await ouvrirAdmin(page, 'History');
    const lignes = page.locator('.admin-ligne');
    await expect(lignes).toHaveCount(3);
    await expect(lignes.nth(0)).toContainText('modification: réglages du site');
    await expect(lignes.nth(0)).toContainText('AP3X Records');
    await expect(lignes.nth(0).getByRole('link', { name: 'View on GitHub' })).toHaveAttribute(
      'href',
      /commit\/c3$/,
    );
    await expect(
      contenu(page).getByRole('button', { name: 'Revert: Merge branch' }),
    ).toBeDisabled();
  });

  test('annule un commit en un clic : un nouveau commit remet l’ancienne version sans rien renvoyer', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { historique: true });
    await ouvrirAdmin(page, 'History');
    await contenu(page)
      .getByRole('button', { name: 'Revert: modification: réglages du site' })
      .click();
    await expect(page.getByRole('dialog')).toContainText('Create a new commit that undoes');
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Change reverted.');
    const commit = depot.commits[0];
    expect(commit?.message).toBe('annulation: modification: réglages du site');
    expect(commit?.fichiers).toEqual([
      { chemin: 'public/site.json', contenu: null, sha: 's-site-avant' },
    ]);
  });

  test('refuse quand les mêmes fichiers ont changé depuis, et le dit', async ({ page }) => {
    const depot = await simulerDepot(page, { historique: true });
    await ouvrirAdmin(page, 'History');
    await contenu(page)
      .getByRole('button', { name: /^Revert: ajout: piste/ })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Confirm' }).click();
    await expect(page.locator('.admin-ligne').first()).toBeVisible();
    await expect(page.getByRole('alert').filter({ hasText: 'changed since' })).toContainText(
      'public/musique/ambient/brume.json',
    );
    expect(depot.commits).toHaveLength(0);
  });

  test('Annuler dans la confirmation ne crée aucun commit', async ({ page }) => {
    const depot = await simulerDepot(page, { historique: true });
    await ouvrirAdmin(page, 'History');
    await contenu(page)
      .getByRole('button', { name: 'Revert: modification: réglages du site' })
      .click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(depot.commits).toHaveLength(0);
  });
});

test('aucune violation axe (WCAG AAA) : réglages, éditeur JSON, historique', async ({ page }) => {
  await simulerDepot(page, { historique: true });
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
  const menu = page.getByRole('navigation', { name: 'Administration sections' });

  await ouvrirAdmin(page, 'Site');
  await contenu(page).getByRole('button', { name: 'Add a link' }).click();
  expect(await violations()).toEqual([]);

  await menu.getByRole('button', { name: 'JSON' }).click();
  await contenu(page).getByRole('combobox', { name: 'File' }).selectOption('public/site.json');
  await expect(page.getByText('Valid JSON that matches the schema.')).toBeVisible();
  expect(await violations()).toEqual([]);

  await menu.getByRole('button', { name: 'History' }).click();
  await expect(page.locator('.admin-ligne')).toHaveCount(3);
  expect(await violations()).toEqual([]);
});
