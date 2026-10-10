// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';
import { refuserLectureAutomatique } from './fixtures/catalogue';

test.use({ reducedMotion: 'reduce' });

const JETON = 'github_pat_FAUX_JETON_DE_TEST';

interface Scenario {
  /** Jeton accepté par l'API simulée. */
  valide?: string;
  ecriture?: boolean;
  deploiement?: 'in_progress' | 'success' | 'failure' | 'aucun';
}

/** Simule l'API GitHub ; renvoie la liste des en-têtes d'autorisation reçus. */
async function simulerGitHub(page: Page, scenario: Scenario = {}): Promise<string[]> {
  const autorisations: string[] = [];
  const { valide = JETON, ecriture = true, deploiement = 'success' } = scenario;
  await page.route('https://api.github.com/**', async (route) => {
    const requete = route.request();
    const autorisation = requete.headers()['authorization'] ?? '';
    autorisations.push(autorisation);
    const url = new URL(requete.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' };
    if (requete.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (autorisation !== `Bearer ${valide}`) {
      await route.fulfill({ status: 401, headers: cors, json: { message: 'Bad credentials' } });
      return;
    }
    if (url.pathname === '/user') {
      await route.fulfill({ headers: cors, json: { login: 'ap3x-test' } });
    } else if (url.pathname === '/repos/ap3demak-rgb/Ap3X') {
      await route.fulfill({ headers: cors, json: { permissions: { push: ecriture } } });
    } else if (url.pathname.endsWith('/runs')) {
      const runs =
        deploiement === 'aucun'
          ? []
          : [
              {
                status: deploiement === 'in_progress' ? 'in_progress' : 'completed',
                conclusion:
                  deploiement === 'in_progress'
                    ? null
                    : deploiement === 'success'
                      ? 'success'
                      : 'failure',
                html_url: 'https://github.com/ap3demak-rgb/Ap3X/actions/runs/1',
                head_sha: 'abcdef1234567',
                created_at: '2026-10-10T09:00:00Z',
              },
            ];
      await route.fulfill({ headers: cors, json: { workflow_runs: runs } });
    } else {
      await route.fulfill({ status: 404, headers: cors, json: {} });
    }
  });
  return autorisations;
}

test.beforeEach(async ({ page }) => {
  await refuserLectureAutomatique(page);
});

test("la page d'administration n'est liée nulle part et demande l'indexation interdite", async ({
  page,
}) => {
  await page.goto('./');
  await expect(page.locator('.carte').first()).toBeVisible();
  await expect(page.locator('a[href*="admin"]')).toHaveCount(0);
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

  await page.goto('./#/admin');
  await expect(page.getByRole('heading', { level: 1, name: 'Administration' })).toBeVisible();
  await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/);

  await page.goto('./#/licences');
  await expect(page.locator('meta[name="robots"]')).toHaveCount(0);
});

test('connexion avec un bon jeton : compte, droit d’écriture et état du déploiement', async ({
  page,
}) => {
  const autorisations = await simulerGitHub(page);
  await page.goto('./#/admin');
  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByRole('button', { name: 'Sign in' }).click();

  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  await expect(page.getByText('Write access to the repository confirmed.')).toBeVisible();
  await expect(page.locator('.admin-deploiement')).toContainText('Completed');
  await expect(page.locator('.admin-deploiement')).toContainText('abcdef1');
  await expect(page.getByRole('link', { name: 'View the run on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/ap3demak-rgb/Ap3X/actions/runs/1',
  );
  expect(autorisations.every((a) => a === `Bearer ${JETON}`)).toBe(true);
});

test('jeton refusé : message clair, champ invalide, rien de mémorisé', async ({ page }) => {
  await simulerGitHub(page);
  await page.goto('./#/admin');
  await page.getByLabel('GitHub token').fill('mauvais');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid or has expired' })).toBeVisible();
  await expect(page.getByLabel('GitHub token')).toHaveAttribute('aria-invalid', 'true');
  const memorise = await page.evaluate(() => [
    sessionStorage.getItem('ap3x.admin.jeton'),
    localStorage.getItem('ap3x.admin.jeton'),
  ]);
  expect(memorise).toEqual([null, null]);
});

test('saisie vide : demande de saisir un jeton sans appeler GitHub', async ({ page }) => {
  const autorisations = await simulerGitHub(page);
  await page.goto('./#/admin');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Enter a token.' })).toBeVisible();
  expect(autorisations).toHaveLength(0);
});

test('jeton sans droit d’écriture : refusé et oublié', async ({ page }) => {
  await simulerGitHub(page, { ecriture: false });
  await page.goto('./#/admin');
  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'cannot write' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);
});

test('le jeton reste dans l’onglet par défaut, sur l’appareil si la case est cochée, et la déconnexion l’efface', async ({
  page,
}) => {
  await simulerGitHub(page);
  await page.goto('./#/admin');
  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  expect(
    await page.evaluate(() => [
      sessionStorage.getItem('ap3x.admin.jeton'),
      localStorage.getItem('ap3x.admin.jeton'),
    ]),
  ).toEqual([JETON, null]);

  // Rechargement : la session de l'onglet suffit pour rester connecté.
  await page.reload();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();

  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page.getByLabel('GitHub token')).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.length + localStorage.length)).toBe(0);

  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByLabel('Stay signed in on this device').check();
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  expect(
    await page.evaluate(() => [
      sessionStorage.getItem('ap3x.admin.jeton'),
      localStorage.getItem('ap3x.admin.jeton'),
    ]),
  ).toEqual([null, JETON]);
});

test('le jeton n’apparaît ni dans la console ni dans le texte de la page', async ({ page }) => {
  const journal: string[] = [];
  page.on('console', (m) => journal.push(m.text()));
  await simulerGitHub(page, { valide: 'autre' });
  await page.goto('./#/admin');
  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'invalid' })).toBeVisible();
  expect(journal.join('\n')).not.toContain(JETON);
  expect(await page.locator('body').innerText()).not.toContain(JETON);
});

test('les états du déploiement sont affichés (en cours, échec, aucun)', async ({ page }) => {
  for (const [etat, attendu] of [
    ['in_progress', 'In progress'],
    ['failure', 'Failed'],
    ['aucun', 'No deployment yet.'],
  ] as const) {
    await page.unrouteAll({ behavior: 'ignoreErrors' });
    await simulerGitHub(page, { deploiement: etat });
    await page.goto('./#/admin');
    await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON);
    await page.reload();
    await expect(page.locator('.admin-deploiement')).toContainText(attendu);
  }
});

test('panne réseau à la connexion : message réseau, le jeton mémorisé est conservé', async ({
  page,
}) => {
  await page.goto('./#/admin');
  await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON);
  await page.route('https://api.github.com/**', (route) => route.abort('connectionfailed'));
  await page.reload();
  await expect(page.getByRole('alert').filter({ hasText: 'Network error' })).toBeVisible();
  expect(await page.evaluate(() => sessionStorage.getItem('ap3x.admin.jeton'))).toBe(JETON);
});

test('aucune violation axe (WCAG AAA) : connexion puis session', async ({ page }) => {
  await simulerGitHub(page);
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

  await page.goto('./#/admin');
  await expect(page.getByLabel('GitHub token')).toBeVisible();
  expect(await violations()).toEqual([]);

  await page.getByLabel('GitHub token').fill(JETON);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page.locator('.admin-deploiement')).toContainText('Completed');
  expect(await violations()).toEqual([]);
});
