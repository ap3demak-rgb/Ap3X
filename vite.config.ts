// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Ap3X/',
  build: {
    outDir: 'dist',
    // Three.js est dans un chunk chargé à la demande (src/rendu3d) : il ne retarde pas l'affichage.
    chunkSizeWarningLimit: 700,
    target: 'es2022',
  },
});
