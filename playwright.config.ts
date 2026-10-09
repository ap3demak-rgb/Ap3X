// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig, devices } from '@playwright/test';

const ARGUMENTS = [
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist',
  // Sortie audio active mais silencieuse : l'horloge de lecture avance comme sur une vraie machine.
  '--mute-audio',
];

/** Parcours de base partagé par tous les navigateurs (seul fichier lancé par les projets ci-dessous). */
const NAVIGATEURS = /navigateurs\.spec\.ts/;

/** Fichier qui exige que la lecture automatique soit autorisée : un projet à part. */
const LECTURE_AUTO = /partage-lecture-auto\.spec\.ts/;

function projet(nom: string, politique?: string) {
  return {
    name: nom,
    use: {
      ...devices['Desktop Chrome'],
      // WebGL logiciel : disponible partout, y compris sur les serveurs d'intégration continue.
      launchOptions: {
        args:
          politique === undefined ? ARGUMENTS : [...ARGUMENTS, `--autoplay-policy=${politique}`],
      },
    },
  };
}

export default defineConfig({
  testDir: 'e2e',
  fullyParallel: false,
  // Le rendu WebGL logiciel sature le processeur : un seul worker évite les délais d'attente aléatoires.
  workers: 1,
  reporter: 'list',
  // Le rendu 3D démarre quelques secondes après le chargement (src/main.ts) : les attentes qui le
  // concernent doivent patienter plus que les 5 secondes par défaut.
  expect: { timeout: 12_000 },
  use: {
    baseURL: 'http://localhost:4173/Ap3X/',
    trace: 'retain-on-failure',
    // Un service worker court-circuiterait `page.route` : les tests qui simulent le réseau ou le
    // catalogue ne le voient pas. Seuls les tests hors ligne l'autorisent (e2e/hors-ligne.spec.ts).
    serviceWorkers: 'block',
  },
  projects: [
    // Politique fixée explicitement : sinon elle dépend de l'environnement (bloquée en local, autorisée
    // sur certains serveurs d'intégration), et l'ouverture d'une page de piste lance ou non la lecture.
    {
      ...projet('chromium', 'document-user-activation-required'),
      testIgnore: [LECTURE_AUTO, NAVIGATEURS],
    },
    { ...projet('lecture-auto', 'no-user-gesture-required'), testMatch: LECTURE_AUTO },
    // Autres moteurs et formats d'écran : parcours de base uniquement (le rendu WebGL et l'audio
    // détaillés sont vérifiés avec Chromium).
    {
      name: 'chrome-bureau',
      testMatch: NAVIGATEURS,
      use: { ...devices['Desktop Chrome'] },
    },
    { name: 'firefox', testMatch: NAVIGATEURS, use: { ...devices['Desktop Firefox'] } },
    { name: 'safari-bureau', testMatch: NAVIGATEURS, use: { ...devices['Desktop Safari'] } },
    { name: 'chrome-mobile', testMatch: NAVIGATEURS, use: { ...devices['Pixel 7'] } },
    { name: 'safari-mobile', testMatch: NAVIGATEURS, use: { ...devices['iPhone 14'] } },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Ap3X/',
    reuseExistingServer: true,
  },
});
