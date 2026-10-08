// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig } from 'vite';

export default defineConfig({
  base: '/Ap3X/',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
