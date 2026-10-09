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

/** Fichiers qui exigent une politique de lecture automatique précise : un projet chacun. */
const LECTURE_AUTO = /partage-lecture-auto\.spec\.ts/;
const LECTURE_BLOQUEE = /partage-lecture-bloquee\.spec\.ts/;

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
  use: {
    baseURL: 'http://localhost:4173/Ap3X/',
    trace: 'retain-on-failure',
  },
  projects: [
    { ...projet('chromium'), testIgnore: [LECTURE_AUTO, LECTURE_BLOQUEE] },
    { ...projet('lecture-auto', 'no-user-gesture-required'), testMatch: LECTURE_AUTO },
    {
      ...projet('lecture-bloquee', 'document-user-activation-required'),
      testMatch: LECTURE_BLOQUEE,
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Ap3X/',
    reuseExistingServer: true,
  },
});
