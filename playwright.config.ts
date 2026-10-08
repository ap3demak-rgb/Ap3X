// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig, devices } from '@playwright/test';

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
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        // WebGL logiciel : disponible partout, y compris sur les serveurs d'intégration continue.
        launchOptions: {
          args: [
            '--use-angle=swiftshader',
            '--enable-unsafe-swiftshader',
            '--ignore-gpu-blocklist',
            // Sortie audio active mais silencieuse : l'horloge de lecture avance comme sur une vraie machine.
            '--mute-audio',
          ],
        },
      },
    },
  ],
  webServer: {
    command: 'npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173/Ap3X/',
    reuseExistingServer: true,
  },
});
