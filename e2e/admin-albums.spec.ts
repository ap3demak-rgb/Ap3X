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

const contenu = (page: Page) => page.locator('.admin-contenu');
const menu = (page: Page) => page.getByRole('navigation', { name: 'Administration sections' });

async function ouvrir(page: Page, section: 'Albums' | 'New album'): Promise<void> {
  await page.goto('./#/admin');
  await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON_TEST);
  await page.reload();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  await menu(page).getByRole('button', { name: section }).click();
}

const textbox = (page: Page, nom: string) =>
  contenu(page).getByRole('textbox', { name: nom, exact: true });

const mp3 = (nom: string, tags: Record<string, string>, taille = 0) => {
  const base = mp3AvecTags(tags);
  return {
    name: nom,
    mimeType: 'audio/mpeg',
    buffer: taille === 0 ? base : Buffer.concat([base, Buffer.alloc(taille)]),
  };
};

const json = (fichier: { contenu: Buffer | null } | undefined): Record<string, unknown> =>
  JSON.parse(fichier?.contenu?.toString('utf8') ?? '{}') as Record<string, unknown>;

/** Trois MP3 donnés dans le désordre, avec numéros de piste dans leurs tags. */
const TROIS_PISTES = [
  mp3('c.mp3', {
    TIT2: 'Troisième',
    TRCK: '3/3',
    TALB: 'Été Indien',
    TPE1: 'Zoé',
    TDRC: '2025-03-14',
    TCON: 'ambient',
  }),
  mp3('a.mp3', { TIT2: 'Premier', TRCK: '1/3', TALB: 'Été Indien', TPE1: 'Zoé' }),
  mp3('b.mp3', { TIT2: 'Deuxième', TRCK: '2/3', TALB: 'Été Indien', TPE1: 'Zoé' }),
];

test.describe('liste des albums', () => {
  test('affiche les albums, brouillons et albums incomplets compris, et les filtre', async ({
    page,
  }) => {
    await simulerDepot(page, { etendu: true });
    await ouvrir(page, 'Albums');
    const lignes = page.locator('.admin-ligne');
    await expect(lignes).toHaveCount(2);
    const club = lignes.filter({ hasText: 'Club' });
    await expect(club).toContainText('EP');
    await expect(club).toContainText('2025');
    await expect(club).toContainText('2 tracks');
    await expect(club).not.toContainText('Draft');
    const nuit = lignes.filter({ hasText: 'Nuit' });
    await expect(nuit).toContainText('Draft');
    await expect(nuit).toContainText('Incomplete');

    await contenu(page).getByRole('combobox', { name: 'Year', exact: true }).selectOption('2025');
    await expect(lignes).toHaveCount(1);
    await contenu(page).getByRole('combobox', { name: 'Year', exact: true }).selectOption('');
    await contenu(page).getByRole('combobox', { name: 'Type', exact: true }).selectOption('ep');
    await expect(lignes).toHaveCount(2);
    await contenu(page).getByRole('combobox', { name: 'Type', exact: true }).selectOption('lp');
    await expect(page.getByText('No album matches.')).toBeVisible();
    await contenu(page).getByRole('combobox', { name: 'Type', exact: true }).selectOption('');
    await contenu(page).getByRole('searchbox').fill('nuit');
    await expect(lignes).toHaveCount(1);
  });
});

test.describe('création d’un album', () => {
  test('plusieurs MP3 : pistes triées d’après leurs tags, album prérempli, type suggéré', async ({
    page,
  }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES);
    const titres = contenu(page).locator('.admin-piste-album input[type="text"]:nth-of-type(1)');
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
    await expect(contenu(page).getByRole('textbox', { name: /^Title of track/ })).toHaveCount(3);
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 1' })).toHaveValue(
      'Premier',
    );
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 2' })).toHaveValue(
      'Deuxième',
    );
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 3' })).toHaveValue(
      'Troisième',
    );
    void titres;
    // Les tags du premier fichier ajouté remplissent l’album.
    await expect(textbox(page, 'Album title')).toHaveValue('Été Indien');
    await expect(textbox(page, 'Album artist')).toHaveValue('Zoé');
    // Artiste de piste identique à l’album : champ laissé vide.
    await expect(contenu(page).getByRole('textbox', { name: /^Artist of track 1/ })).toHaveValue(
      '',
    );
    await expect(
      contenu(page).getByRole('combobox', { name: 'Type', exact: true }).locator('option').first(),
    ).toHaveText('Automatic (EP)');
    await expect(contenu(page).getByText('3 tracks')).toBeVisible();
  });

  test('réordonner avec les boutons, changer de disque, retirer une piste', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES);
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);

    await contenu(page).getByRole('button', { name: 'Move up: Deuxième' }).click();
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 1' })).toHaveValue(
      'Deuxième',
    );
    await expect(contenu(page).getByRole('button', { name: 'Move up: Deuxième' })).toBeDisabled();
    // Le bouton utilisé est devenu inactif : le focus passe au bouton opposé.
    await expect(contenu(page).getByRole('button', { name: 'Move down: Deuxième' })).toBeFocused();

    // « Troisième » passe sur le disque 2 : il reste regroupé en fin de liste et la numérotation suit.
    await contenu(page).getByRole('spinbutton', { name: 'Disc of track 3' }).fill('2');
    await contenu(page).getByRole('spinbutton', { name: 'Disc of track 3' }).press('Tab');
    await expect(contenu(page).locator('.admin-numero').last()).toHaveText('2.1');

    await contenu(page).getByRole('button', { name: 'Remove: Premier' }).click();
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(2);
    await expect(contenu(page).getByText('2 tracks')).toBeVisible();
  });

  test('publie l’album en un commit : MP3, fiches, pochette et album.json avec l’ordre et les disques', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES);
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
    await contenu(page).getByRole('spinbutton', { name: 'Disc of track 3' }).fill('2');
    await contenu(page).getByRole('spinbutton', { name: 'Disc of track 3' }).press('Tab');
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'c.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(contenu(page).getByText(/Cover ready/)).toBeVisible();
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(page.locator('.admin-succes')).toHaveText(
      'Album published. The site updates in a minute or two.',
    );

    expect(depot.commits).toHaveLength(1);
    const commit = depot.commits[0];
    expect(commit?.message).toBe('ajout: album « Été Indien »');
    const dossier = 'public/musique/ambient/ete-indien';
    expect(commit?.fichiers.map((f) => f.chemin).sort()).toEqual([
      `${dossier}/album.json`,
      `${dossier}/cover.webp`,
      `${dossier}/deuxieme.json`,
      `${dossier}/deuxieme.mp3`,
      `${dossier}/premier.json`,
      `${dossier}/premier.mp3`,
      `${dossier}/troisieme.json`,
      `${dossier}/troisieme.mp3`,
    ]);
    expect(json(commit?.fichiers.find((f) => f.chemin.endsWith('album.json')))).toEqual({
      titre: 'Été Indien',
      artiste: 'Zoé',
      date: '2025-03-14',
      pistes: ['premier.mp3', 'deuxieme.mp3', { fichier: 'troisieme.mp3', disque: 2 }],
    });
    expect(json(commit?.fichiers.find((f) => f.chemin.endsWith('premier.json')))).toEqual({
      titre: 'Premier',
    });
  });

  test('la pochette intégrée au premier MP3 sert de pochette à l’album', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New album');
    // Un MP3 dont le tag ID3 porte une image (trame APIC) : PNG valide.
    const png = pngDeTest();
    const apic = Buffer.concat([
      Buffer.from([0]),
      Buffer.from('image/png\0', 'latin1'),
      Buffer.from([3]),
      Buffer.from('\0', 'latin1'),
      png,
    ]);
    const taille = apic.length;
    const synchsafe = (n: number): number[] => [
      (n >> 21) & 0x7f,
      (n >> 14) & 0x7f,
      (n >> 7) & 0x7f,
      n & 0x7f,
    ];
    const trame = Buffer.concat([
      Buffer.from('APIC'),
      Buffer.from(synchsafe(taille)),
      Buffer.from([0, 0]),
      apic,
    ]);
    const tit2 = mp3AvecTags({ TIT2: 'Avec image' }).subarray(
      10,
      mp3AvecTags({ TIT2: 'Avec image' }).length - 256,
    );
    const corps = Buffer.concat([tit2, trame]);
    const fichier = Buffer.concat([
      Buffer.from([0x49, 0x44, 0x33, 4, 0, 0, ...synchsafe(corps.length)]),
      corps,
      Buffer.alloc(256, 0xff),
    ]);
    await contenu(page).getByLabel('Add MP3 files').setInputFiles({
      name: 'image.mp3',
      mimeType: 'audio/mpeg',
      buffer: fichier,
    });
    await expect(contenu(page).getByText(/Cover taken from the tags of image.mp3/)).toBeVisible();
    await textbox(page, 'Album title').fill('Pochette tirée');
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('techno');
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    expect(depot.commits[0]?.fichiers.some((f) => f.chemin.endsWith('/cover.webp'))).toBe(true);
  });

  test('un brouillon est masqué ; sans pochette, la publication est refusée', async ({ page }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES.slice(0, 1));
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(1);
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(page.locator('.admin-formulaire > .erreur-champ')).toContainText(
      'A published album needs a cover image.',
    );
    expect(depot.commits).toHaveLength(0);

    await contenu(page).getByLabel('Publish immediately').uncheck();
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Draft saved.');
    expect(depot.commits[0]?.message).toBe("ajout: brouillon d'album « Été Indien »");
    expect(
      json(depot.commits[0]?.fichiers.find((f) => f.chemin.endsWith('album.json')))['visible'],
    ).toBe(false);
  });

  test('validation : aucune piste, titre manquant, titre de piste vide, album déjà existant', async ({
    page,
  }) => {
    const depot = await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    const alerte = page.locator('.admin-formulaire > .erreur-champ');
    await expect(alerte).toContainText('Add at least one track.');
    await expect(alerte).toContainText('Enter a title.');
    await expect(textbox(page, 'Album title')).toHaveAttribute('aria-invalid', 'true');
    await expect(textbox(page, 'Album title')).toBeFocused();

    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES.slice(0, 1));
    await contenu(page).getByRole('textbox', { name: 'Title of track 1' }).fill('');
    await textbox(page, 'Album title').fill('Club');
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('techno');
    await contenu(page).getByLabel('Publish immediately').uncheck();
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(alerte).toContainText('Every track needs a title.');
    // Les collisions ne sont examinées qu'une fois le formulaire complet.
    await contenu(page).getByRole('textbox', { name: 'Title of track 1' }).fill('Intro');
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();
    await expect(alerte).toContainText('already exist');
    expect(depot.commits).toHaveLength(0);
  });

  test('un fichier qui n’est pas un MP3 est refusé', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page)
      .getByLabel('Add MP3 files')
      .setInputFiles({
        name: 'notes.txt',
        mimeType: 'text/plain',
        buffer: Buffer.from('x'),
      });
    await expect(contenu(page).getByRole('alert').filter({ hasText: 'not an MP3' })).toBeVisible();
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(0);
  });

  test('un gros envoi est découpé et reprend après une coupure sans renvoyer ce qui est publié', async ({
    page,
  }) => {
    test.setTimeout(120_000);
    // 2 MP3 de 14 Mo : au-delà de 25 Mo, l’envoi se fait en plusieurs commits.
    // Le 3e commit (envoi du 2e MP3) échoue une fois par coupure réseau.
    const depot = await simulerDepot(page, { echecsReference: [3] });
    await ouvrir(page, 'New album');
    await contenu(page)
      .getByLabel('Add MP3 files')
      .setInputFiles([
        mp3('un.mp3', { TIT2: 'Un', TRCK: '1' }, 14 * 1024 * 1024),
        mp3('deux.mp3', { TIT2: 'Deux', TRCK: '2' }, 14 * 1024 * 1024),
      ]);
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(2);
    await textbox(page, 'Album title').fill('Gros Album');
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('ambient');
    await contenu(page).getByLabel('Cover image').setInputFiles({
      name: 'c.png',
      mimeType: 'image/png',
      buffer: pngDeTest(),
    });
    await expect(contenu(page).getByText(/Cover ready/)).toBeVisible();
    await contenu(page).getByRole('button', { name: 'Save the album' }).click();

    // Coupure au 3e commit : 2 sont publiés, le formulaire est verrouillé et la reprise proposée.
    await expect(contenu(page).getByRole('button', { name: 'Resume the upload' })).toBeVisible({
      timeout: 60_000,
    });
    await expect(contenu(page).getByText(/interrupted after 2 of 4 commits/)).toBeVisible();
    await expect(
      contenu(page).getByRole('alert').filter({ hasText: 'Network error' }),
    ).toBeVisible();
    await expect(textbox(page, 'Album title')).toBeDisabled();
    expect(depot.commits).toHaveLength(2);
    // Premier commit : structure et album masqué, sans MP3.
    expect(depot.commits[0]?.fichiers.some((f) => f.chemin.endsWith('.mp3'))).toBe(false);
    expect(
      json(depot.commits[0]?.fichiers.find((f) => f.chemin.endsWith('album.json')))['visible'],
    ).toBe(false);

    await contenu(page).getByRole('button', { name: 'Resume the upload' }).click();
    await expect(page.locator('.admin-succes')).toContainText('Album published.', {
      timeout: 60_000,
    });
    expect(depot.commits).toHaveLength(4);
    const envoyes = depot.commits.flatMap((c) =>
      c.fichiers.filter((f) => f.chemin.endsWith('.mp3')),
    );
    expect(envoyes.map((f) => f.chemin).sort()).toEqual([
      'public/musique/ambient/gros-album/deux.mp3',
      'public/musique/ambient/gros-album/un.mp3',
    ]);
    // Dernier commit : l’album redevient visible.
    const final = json(depot.commits[3]?.fichiers.find((f) => f.chemin.endsWith('album.json')));
    expect(final).not.toHaveProperty('visible');
    expect(final['pistes']).toEqual(['un.mp3', 'deux.mp3']);
  });

  test('l’aperçu liste les pistes dans l’ordre avec le type', async ({ page }) => {
    await simulerDepot(page);
    await ouvrir(page, 'New album');
    await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES);
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
    await contenu(page).getByRole('button', { name: 'Preview the public page' }).click();
    const apercu = contenu(page).locator('.admin-apercu-page');
    await expect(apercu.getByRole('heading', { name: 'Été Indien' })).toBeVisible();
    await expect(apercu.locator('.admin-apercu-pistes li')).toHaveText([
      /1\. Premier/,
      /2\. Deuxième/,
      /3\. Troisième/,
    ]);
    await expect(apercu).toContainText('EP');
  });
});

test.describe('modification d’un album', () => {
  async function modifierClub(page: Page): Promise<void> {
    await ouvrir(page, 'Albums');
    await contenu(page).getByRole('button', { name: 'Edit : Club' }).click();
    await expect(textbox(page, 'Album title')).toHaveValue('Club');
  }

  test('reprend l’album et ses pistes ; rien n’est publié sans changement', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 1' })).toHaveValue(
      '01-intro',
    );
    await expect(contenu(page).getByRole('textbox', { name: 'Title of track 2' })).toHaveValue(
      'Outro',
    );
    await expect(contenu(page).getByRole('textbox', { name: /^Artist of track 2/ })).toHaveValue(
      'Invité',
    );
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.getByText('Nothing to save.')).toBeVisible();
    expect(depot.commits).toHaveLength(0);
  });

  test('réordonner les pistes ne modifie que album.json', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await contenu(page).getByRole('button', { name: 'Move up: Outro' }).click();
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const commit = depot.commits[0];
    expect(commit?.message).toBe('modification: album « Club »');
    expect(commit?.fichiers.map((f) => f.chemin)).toEqual([
      'public/musique/techno/club/album.json',
    ]);
    expect(json(commit?.fichiers[0])['pistes']).toEqual(['02-outro.mp3', '01-intro.mp3']);
  });

  test('ajouter une piste et en renommer une', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await contenu(page).getByRole('textbox', { name: 'Title of track 1' }).fill('Introduction');
    await contenu(page)
      .getByLabel('Add MP3 files')
      .setInputFiles(mp3('z.mp3', { TIT2: 'Final' }));
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const chemins = depot.commits[0]?.fichiers.map((f) => f.chemin).sort();
    expect(chemins).toEqual([
      'public/musique/techno/club/01-intro.json',
      'public/musique/techno/club/album.json',
      'public/musique/techno/club/final.json',
      'public/musique/techno/club/final.mp3',
    ]);
    expect(
      json(depot.commits[0]?.fichiers.find((f) => f.chemin.endsWith('01-intro.json'))),
    ).toEqual({
      titre: 'Introduction',
    });
  });

  test('retirer une piste : elle redevient un titre seul avec la pochette de l’album', async ({
    page,
  }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await contenu(page).getByRole('button', { name: 'Remove: Outro' }).click();
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const parChemin = new Map(depot.commits[0]?.fichiers.map((f) => [f.chemin, f]));
    expect(parChemin.get('public/musique/techno/02-outro.mp3')?.sha).toBe('m-outro');
    expect(parChemin.get('public/musique/techno/02-outro.webp')?.sha).toBe('i-club');
    expect(parChemin.get('public/musique/techno/club/02-outro.mp3')?.sha).toBeNull();
    expect(json(parChemin.get('public/musique/techno/02-outro.json'))).toEqual({
      titre: 'Outro',
      artiste: 'Invité',
      pochette: '02-outro.webp',
    });
    expect(json(parChemin.get('public/musique/techno/club/album.json'))['pistes']).toEqual([
      '01-intro.mp3',
    ]);
  });

  test('déplacer l’album dans une autre catégorie sans renvoyer aucun MP3', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await contenu(page)
      .getByRole('combobox', { name: 'Category', exact: true })
      .selectOption('ambient');
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const commit = depot.commits[0];
    expect(commit?.message).toBe('déplacement: album « Club » vers ambient');
    const parChemin = new Map(commit?.fichiers.map((f) => [f.chemin, f]));
    expect(parChemin.get('public/musique/ambient/club/01-intro.mp3')?.sha).toBe('m-intro');
    expect(parChemin.get('public/musique/ambient/club/cover.webp')?.sha).toBe('i-club');
    expect(parChemin.get('public/musique/techno/club/01-intro.mp3')?.sha).toBeNull();
    expect(parChemin.get('public/musique/ambient/club/album.json')?.contenu).not.toBeNull();
  });

  test('rattacher un titre seul publié à l’album', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await modifierClub(page);
    await contenu(page)
      .getByRole('combobox', { name: 'Add a published track' })
      .selectOption({ label: 'ambient / brume' });
    await contenu(page).getByRole('button', { name: 'Add', exact: true }).click();
    await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
    await contenu(page).getByRole('button', { name: 'Save the changes' }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const parChemin = new Map(depot.commits[0]?.fichiers.map((f) => [f.chemin, f]));
    expect(parChemin.get('public/musique/techno/club/brume.mp3')?.sha).toBe('m-brume');
    expect(parChemin.get('public/musique/ambient/brume.mp3')?.sha).toBeNull();
    expect(json(parChemin.get('public/musique/techno/club/album.json'))['pistes']).toEqual([
      '01-intro.mp3',
      '02-outro.mp3',
      'brume.mp3',
    ]);
  });
});

test.describe('suppression d’un album', () => {
  test('en conservant les pistes comme titres seuls', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await ouvrir(page, 'Albums');
    await contenu(page).getByRole('button', { name: 'Delete : Club' }).click();
    const dialogue = page.getByRole('dialog');
    await expect(dialogue).toContainText('Delete the album “Club”?');
    await expect(dialogue.getByRole('radio').first()).toBeChecked();
    await dialogue.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('.admin-succes')).toContainText('Album deleted.');
    const commit = depot.commits[0];
    expect(commit?.message).toBe('suppression: album « Club » (pistes conservées)');
    const parChemin = new Map(commit?.fichiers.map((f) => [f.chemin, f]));
    expect(parChemin.get('public/musique/techno/01-intro.mp3')?.sha).toBe('m-intro');
    expect(parChemin.get('public/musique/techno/02-outro.mp3')?.sha).toBe('m-outro');
    expect(parChemin.get('public/musique/techno/club/album.json')?.sha).toBeNull();
    expect(parChemin.get('public/musique/techno/club/cover.webp')?.sha).toBeNull();
  });

  test('avec ses pistes', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await ouvrir(page, 'Albums');
    await contenu(page).getByRole('button', { name: 'Delete : Club' }).click();
    const dialogue = page.getByRole('dialog');
    await dialogue.getByRole('radio', { name: 'Delete them with the album' }).check();
    await dialogue.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(page.locator('.admin-succes')).toBeVisible();
    const commit = depot.commits[0];
    expect(commit?.message).toBe('suppression: album « Club » et ses pistes');
    expect(commit?.fichiers.every((f) => f.sha === null)).toBe(true);
    expect(commit?.fichiers.length).toBe(5);
  });

  test('Annuler ne supprime rien', async ({ page }) => {
    const depot = await simulerDepot(page, { etendu: true });
    await ouvrir(page, 'Albums');
    await contenu(page).getByRole('button', { name: 'Delete : Club' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(depot.commits).toHaveLength(0);
  });
});

test('aucune violation axe (WCAG AAA) : liste d’albums, formulaire avec pistes, aperçu, boîte de suppression', async ({
  page,
}) => {
  await simulerDepot(page, { etendu: true });
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

  await ouvrir(page, 'Albums');
  await expect(page.locator('.admin-ligne')).toHaveCount(2);
  expect(await violations()).toEqual([]);

  await contenu(page).getByRole('button', { name: 'Delete : Club' }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  expect(await violations()).toEqual([]);
  await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

  await menu(page).getByRole('button', { name: 'New album' }).click();
  await contenu(page).getByLabel('Add MP3 files').setInputFiles(TROIS_PISTES);
  await expect(contenu(page).locator('.admin-piste-album')).toHaveCount(3);
  await contenu(page).getByRole('button', { name: 'Preview the public page' }).click();
  await expect(contenu(page).locator('.admin-apercu-page')).toBeVisible();
  expect(await violations()).toEqual([]);
});
