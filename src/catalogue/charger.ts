// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Catalogue } from './schemas';

let promesse: Promise<Catalogue> | undefined;

/** Charge et valide public/catalogue.json une seule fois ; une erreur permet un nouvel essai. */
export function chargerCatalogue(): Promise<Catalogue> {
  promesse ??= (async () => {
    const reponse = await fetch(`${import.meta.env.BASE_URL}catalogue.json`);
    if (!reponse.ok) {
      throw new Error(`catalogue.json : réponse HTTP ${reponse.status}`);
    }
    // zod n'est chargé qu'ici, quand le catalogue est arrivé : il ne retarde pas le premier affichage.
    const { CatalogueSchema } = await import('./schemas');
    return CatalogueSchema.parse(await reponse.json());
  })().catch((erreur: unknown) => {
    promesse = undefined;
    throw erreur;
  });
  return promesse;
}

/** Résolution d'un chemin du catalogue (déjà encodé, relatif à public/) en URL absolue du site. */
export function urlDuFichier(chemin: string): string {
  return `${import.meta.env.BASE_URL}${chemin}`;
}
