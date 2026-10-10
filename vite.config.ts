// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { defineConfig, type Plugin } from 'vite';
import { BASE_SITE, URL_SITE } from './src/constantes.ts';
import { baliseReglages, echapperHtml, lireSite } from './scripts/site.ts';

/** Adresse publique du site (surchargeable avec SITE_URL), toujours terminée par « / ». */
const urlSite = (process.env['SITE_URL'] ?? URL_SITE).replace(/\/*$/, '/');

/**
 * Insère dans index.html l'adresse du site et les réglages de `public/site.json` (nom, description, et le
 * JSON complet dans une balise lue au démarrage). Un fichier de réglages invalide arrête le build.
 */
function constantesHtml(): Plugin {
  return {
    name: 'constantes-html',
    transformIndexHtml: (html) => {
      const site = lireSite();
      return html
        .replaceAll('%URL_SITE%', urlSite)
        .replaceAll('%NOM_SITE%', echapperHtml(site.nom))
        .replaceAll('%DESCRIPTION_SITE%', echapperHtml(site.description))
        .replace(
          '</head>',
          `${baliseReglages(site)}
  </head>`,
        );
    },
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
