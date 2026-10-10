// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { lireSite } from './site.ts';
import { terminer } from './utilitaires.ts';

/** Contrôle de `public/site.json` : même validation stricte que le build et la page d'administration. */
const erreurs: string[] = [];
try {
  lireSite();
} catch (erreur) {
  erreurs.push((erreur as Error).message);
}
terminer(erreurs, 'Réglages du site : public/site.json valide.');
