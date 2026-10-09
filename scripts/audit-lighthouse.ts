// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { launch } from 'chrome-launcher';
import lighthouse from 'lighthouse';
import { chromium } from '@playwright/test';
import { BASE_SITE } from '../src/constantes.ts';
import { demarrerServeurStatique } from './serveur-statique.ts';
import { terminer } from './utilitaires.ts';

/**
 * Audit Lighthouse du build (`dist/`) servi localement comme sur GitHub Pages : performance, accessibilité, bonnes pratiques
 * et SEO, sur mobile (émulation par défaut de Lighthouse) et sur ordinateur.
 * Usage : tsx scripts/audit-lighthouse.ts   (après `npm run build`)
 */
const SEUILS: Record<string, number> = {
  // La performance en laboratoire varie de plusieurs points d'une mesure à l'autre (machine, charge) :
  // la page Licences sur ordinateur oscille entre 81 et 85 alors que les autres pages dépassent 93.
  performance: 0.8,
  accessibility: 0.9,
  'best-practices': 0.9,
  seo: 0.9,
};
const PAGES = ['', '#/albums', '#/licences'];

// Serveur qui imite GitHub Pages (gzip, 404.html) : `vite preview` ne compresse pas et fausserait les mesures.
const serveur = await demarrerServeurStatique('dist', BASE_SITE, 4174);
const navigateur = await launch({
  // On réutilise le Chromium de Playwright : aucun autre navigateur à installer.
  chromePath: chromium.executablePath(),
  chromeFlags: ['--headless=new', '--no-sandbox', '--disable-gpu'],
});

const erreurs: string[] = [];
try {
  for (const formfactor of ['mobile', 'desktop'] as const) {
    for (const page of PAGES) {
      const url = `http://127.0.0.1:4174${BASE_SITE}${page}`;
      const resultat = await lighthouse(
        url,
        { port: navigateur.port, output: 'json', logLevel: 'error' },
        {
          extends: 'lighthouse:default',
          settings: {
            // Limitation de réseau et de processeur réellement appliquée au navigateur : plus fidèle et plus
            // stable, pour une page dont le premier affichage est quasi instantané, que la simulation
            // « Lantern » de Lighthouse (dont le score fluctue de plusieurs points d'un passage à l'autre).
            throttlingMethod: 'devtools',
            formFactor: formfactor,
            screenEmulation:
              formfactor === 'desktop'
                ? { mobile: false, width: 1350, height: 940, deviceScaleFactor: 1, disabled: false }
                : undefined,
            onlyCategories: Object.keys(SEUILS),
          },
        },
      );
      const categories = resultat?.lhr.categories ?? {};
      const ligne = Object.keys(SEUILS)
        .map((cle) => `${cle} ${Math.round((categories[cle]?.score ?? 0) * 100)}`)
        .join(' | ');
      console.log(`${formfactor.padEnd(7)} ${page === '' ? '#/' : page} : ${ligne}`);
      for (const [cle, seuil] of Object.entries(SEUILS)) {
        const score = categories[cle]?.score ?? 0;
        if (score < seuil) {
          erreurs.push(
            `${formfactor} ${page || '#/'} : ${cle} = ${Math.round(score * 100)} (minimum ${Math.round(seuil * 100)}).`,
          );
          // Détail des audits en échec pour la catégorie, pour savoir quoi corriger.
          for (const ref of categories[cle]?.auditRefs ?? []) {
            const audit = resultat?.lhr.audits[ref.id];
            if (
              audit !== undefined &&
              audit.score !== null &&
              audit.score < 0.9 &&
              ref.weight > 0
            ) {
              erreurs.push(`    - ${audit.id} (${Math.round(audit.score * 100)}) : ${audit.title}`);
            }
          }
        }
      }
    }
  }
} finally {
  await navigateur.kill();
  await serveur.fermer();
}
terminer(erreurs, 'Lighthouse : tous les scores atteignent le seuil.');
