// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig, type Plugin } from 'vite';
import { BASE_SITE, DESCRIPTION_SITE, NOM_SITE, URL_SITE } from './src/constantes.ts';

/** Adresse publique du site (surchargeable avec SITE_URL), toujours terminée par « / ». */
const urlSite = (process.env['SITE_URL'] ?? URL_SITE).replace(/\/*$/, '/');

/** Insère dans index.html les constantes du site (adresse, nom, description) : source unique. */
function constantesHtml(): Plugin {
  return {
    name: 'constantes-html',
    transformIndexHtml: (html) =>
      html
        .replaceAll('%URL_SITE%', urlSite)
        .replaceAll('%NOM_SITE%', NOM_SITE)
        .replaceAll('%DESCRIPTION_SITE%', DESCRIPTION_SITE),
  };
}

export default defineConfig({
  base: BASE_SITE,
  plugins: [constantesHtml()],
  build: {
    outDir: 'dist',
    // Three.js est dans un chunk chargé à la demande (src/rendu3d) : il ne retarde pas l'affichage.
    chunkSizeWarningLimit: 700,
    target: 'es2022',
  },
});
