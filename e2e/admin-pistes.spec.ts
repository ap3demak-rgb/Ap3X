// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';
import { JETON_TEST, mp3AvecTags, pngDeTest, simulerDepot } from './fixtures/github';

test.use({ reducedMotion: 'reduce' });

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

/** Ouvre l'administration déjà connectée, sur la section demandée. */
async function ouvrir(page: Page, section: 'Tracks' | 'New track'): Promise<void> {
  await page.goto('./#/admin');
  await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON_TEST);
  await page.reload();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Administration sections' })
    .getByRole('button', { name: section })
    .click();
}

const contenu = (page: Page) => page.locator('.admin-contenu');

const MP3_ETOILE = (): { name: string; mimeType: string; buffer: Buffer } => ({
  name: 'export-final.mp3',
  mimeType: 'audio/mpeg',
  buffer: mp3AvecTags({
    TIT2: 'Étoile filante',
    TPE1: 'Zoé',
    TDRC: '2025-03-14',
    TCON: 'ambient',
    COMM: '\u0000fra\u0000Une nuit claire',
  }),
});

test.describe('liste des pistes', () => {
  test('affiche les pistes du dépôt, brouillons compris, avec leurs titres et hashtags', async ({
    page,
  }) => {
    await simulerDepot(page);
    await ouvrir(page, 'Tracks');
    const lignes = page.locator('.admin-ligne');
    await expect(lignes).toHaveCount(3);
    await expect(lignes.filter({ hasText: 'Brume' })).toContainText('Draft');
    await expect(lignes.filter({ hasText: 'Brume' })).toContainText('#nuit #calme');
    await expect(lignes.filter({ hasText: 'Trois Cents' })).not.toContainText('Draft');
    await expect(lignes.filter({ hasText: 'intro' })).toContainText('club');
    await expect(page.getByText('3 tracks')).toBeVisible();
  });

  test('recherche, filtre par catégorie et par hashtag, tri', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'Tracks');
    const lignes = page.locator('.admin-ligne');
    await expect(lignes).toHaveCount(3);

    await contenu(page).getByRole('searchbox', { name: 'Search', exact: true }).fill('trois');
    await expect(lignes).toHaveCount(1);
    await contenu(page).getByRole('searchbox', { name: 'Search', exact: true }).fill('zzz');
    await expect(page.getByText('No track matches.')).toBeVisible();
    await contenu(page).getByRole('searchbox', { name: 'Search', exact: true }).fill('');

    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('ambient');
    await expect(lignes).toHaveCount(1);
    await contenu(page).getByRole('combobox', { name: 'Category', exact: true }).selectOption('');

    await contenu(page)
      .getByRole('combobox', { name: 'Hashtag', exact: true })
      .selectOption('nuit');
    await expect(lignes).toHaveCount(2);
    await contenu(page)
      .getByRole('combobox', { name: 'Sort by', exact: true })
      .selectOption('categorie');
    await expect(lignes.first()).toContainText('Brume');
  });
});

test.describe('nouvelle piste', () => {
  test('les tags du MP3 préremplissent le formulaire', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    await expect(contenu(page).getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Étoile filante',
    );
    await expect(contenu(page).getByRole('textbox', { name: 'Artist', exact: true })).toHaveValue(
      'Zoé',
    );
    await expect(contenu(page).getByLabel('Date (YYYY')).toHaveValue('2025-03-14');
    await expect(
      contenu(page).getByRole('combobox', { name: 'Category', exact: true }),
    ).toHaveValue('ambient');
    await expect(
      contenu(page).getByRole('textbox', { name: 'Description', exact: true }),
    ).toHaveValue('Une nuit claire');
    await expect(page.locator('.admin-fichier')).toContainText('export-final.mp3');
  });

  test('un MP3 avec une pochette est publié en un seul commit : MP3, fiche JSON et image WebP', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    await expect(contenu(page).getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      'Étoile filante',
    );
    await contenu(page).getByLabel('Hashtags').fill('#Nuit, claire');
    await contenu(page).getByLabel('Allow downloading the MP3').check();
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(page.locator('.admin-apercu')).toBeVisible();
    await expect(page.getByText(/Cover ready: 4 × 4 px/)).toBeVisible();

    await page.getByRole('button', { name: 'Save the track' }).click();
    await expect(page.locator('.admin-succes')).toHaveText(
      'Track published. The site updates in a minute or two.',
    );

    expect(depot.commits).toHaveLength(1);
    const commit = depot.commits[0];
    expect(commit?.message).toBe('ajout: piste « Étoile filante »');
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      'public/musique/ambient/etoile-filante.json',
      'public/musique/ambient/etoile-filante.mp3',
      'public/musique/ambient/etoile-filante.webp',
    ]);
    const fiche = JSON.parse(
      commit?.fichiers.find((f) => f.chemin.endsWith('.json'))?.contenu?.toString('utf8') ?? '{}',
    ) as Record<string, unknown>;
    expect(fiche).toEqual({
      titre: 'Étoile filante',
      artiste: 'Zoé',
      description: 'Une nuit claire',
      hashtags: ['nuit', 'claire'],
      pochette: 'etoile-filante.webp',
      date: '2025-03-14',
      telechargement: true,
      copyright: '© 2026 AP3X Records',
    });
    const mp3 = commit?.fichiers.find((f) => f.chemin.endsWith('.mp3'))?.contenu;
    expect(mp3?.subarray(0, 3).toString('ascii')).toBe('ID3');
    const image = commit?.fichiers.find((f) => f.chemin.endsWith('.webp'))?.contenu;
    expect(image?.subarray(0, 4).toString('ascii')).toBe('RIFF');
  });

  test('sans publication immédiate, la piste est un brouillon et une nouvelle catégorie crée son dossier', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption({ label: 'New category…' });
    await contenu(page)
      .getByRole('textbox', { name: 'Name of the new category' })
      .fill('Deep House');
    await contenu(page).getByLabel('Publish immediately').uncheck();
    await page.getByRole('button', { name: 'Save the track' }).click();
    await expect(page.locator('.admin-succes')).toHaveText(
      'Draft saved. The track stays hidden until you publish it.',
    );

    const commit = depot.commits[0];
    expect(commit?.message).toBe('ajout: brouillon de piste « Étoile filante »');
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      'public/musique/deep-house/etoile-filante.json',
      'public/musique/deep-house/etoile-filante.mp3',
    ]);
    const fiche = JSON.parse(commit?.fichiers[1]?.contenu?.toString('utf8') ?? '{}') as {
      visible?: boolean;
    };
    expect(fiche.visible).toBe(false);
  });

  test('après une publication, la liste relit le dépôt et le formulaire est vide', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    const avant = depot.lecturesArbre();
    await page.getByRole('button', { name: 'Save the track' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Track published.');
    await expect(contenu(page).getByRole('textbox', { name: 'Title', exact: true })).toHaveValue(
      '',
    );
    await page
      .getByRole('navigation', { name: 'Administration sections' })
      .getByRole('button', { name: 'Tracks' })
      .click();
    await expect(page.locator('.admin-ligne')).toHaveCount(3);
    // Le dépôt a été relu après la publication (une fois, puis servi depuis la mémoire).
    expect(depot.lecturesArbre()).toBe(avant + 1);
  });

  test('formulaire incomplet : erreurs claires, champs invalides, aucun appel d’écriture', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('Date (YYYY').fill('hier');
    await page.getByRole('button', { name: 'Save the track' }).click();
    const alerte = page
      .locator('.admin-formulaire')
      .getByRole('alert')
      .filter({ hasText: 'Choose an MP3 file.' });
    await expect(alerte).toContainText('Enter a title.');
    await expect(alerte).toContainText('Choose a category or name a new one.');
    await expect(alerte).toContainText('The date must be');
    await expect(contenu(page).getByLabel('MP3 file')).toHaveAttribute('aria-invalid', 'true');
    await expect(contenu(page).getByLabel('MP3 file')).toBeFocused();
    expect(depot.commits).toHaveLength(0);
  });

  test('un titre déjà pris dans la catégorie est refusé avec l’identifiant en cause', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page)
      .getByLabel('MP3 file')
      .setInputFiles({
        name: 'a.mp3',
        mimeType: 'audio/mpeg',
        buffer: mp3AvecTags({ TIT2: 'Brume', TCON: 'ambient' }),
      });
    await page.getByRole('button', { name: 'Save the track' }).click();
    await expect(page.locator('.admin-formulaire').getByRole('alert')).toContainText(
      'ambient--brume',
    );
    expect(depot.commits).toHaveLength(0);
  });

  test('un fichier qui n’est pas un MP3 est refusé', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page)
      .getByLabel('MP3 file')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('bonjour'),
      });
    await expect(page.locator('.admin-formulaire').getByRole('alert')).toContainText(
      'This file is not an MP3 file.',
    );
    await expect(page.locator('.admin-fichier')).toHaveText('');
  });

  test('une image illisible comme pochette est signalée', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New track');
    await contenu(page)
      .getByLabel('Cover image')
      .setInputFiles({
        name: 'faux.png',
        mimeType: 'image/png',
        buffer: Buffer.from('pas une image'),
      });
    await expect(page.getByText('This image cannot be read.')).toBeVisible();
    await expect(page.locator('.admin-apercu')).toBeHidden();
  });

  test('si le dépôt a changé entre-temps, le conflit est expliqué et rien n’est déclaré publié', async ({
    page,
  }) => {
    await simulerDepot(page, { statutReference: 422 });
    await ouvrir(page, 'New track');
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    await page.getByRole('button', { name: 'Save the track' }).click();
    await expect(page.locator('.admin-formulaire').getByRole('alert')).toContainText(
      'The repository changed in the meantime',
    );
    await expect(page.locator('.admin-succes')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Save the track' })).toBeEnabled();
  });

  test('le navigateur avertit avant de quitter la page avec des modifications non enregistrées', async ({
    page,
  }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New track');
    const sansAvertissement = await page.evaluate(() => {
      const evenement = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evenement);
      return !evenement.defaultPrevented;
    });
    expect(sansAvertissement).toBe(true);
    await contenu(page).getByRole('textbox', { name: 'Title', exact: true }).fill('Brouillon');
    const avecAvertissement = await page.evaluate(() => {
      const evenement = new Event('beforeunload', { cancelable: true });
      window.dispatchEvent(evenement);
      return evenement.defaultPrevented;
    });
    expect(avecAvertissement).toBe(true);
  });

  test('aucune violation axe (WCAG AAA) : liste et formulaire', async ({ page }) => {
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

    await ouvrir(page, 'Tracks');
    await expect(page.locator('.admin-ligne')).toHaveCount(3);
    expect(await violations()).toEqual([]);

    await page
      .getByRole('navigation', { name: 'Administration sections' })
      .getByRole('button', { name: 'New track' })
      .click();
    await expect(contenu(page).getByLabel('MP3 file')).toBeVisible();
    await contenu(page).getByLabel('MP3 file').setInputFiles(MP3_ETOILE());
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'cover.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(page.locator('.admin-apercu')).toBeVisible();
    expect(await violations()).toEqual([]);
  });
});
