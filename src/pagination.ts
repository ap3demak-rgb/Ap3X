// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Nombre de cartes affichées d'emblée, puis ajoutées à chaque clic sur « Voir plus ». */
export const TAILLE_PAGE = 48;

/** Nombre d'éléments affichés après avoir demandé la page suivante (jamais plus que le total). */
export function prochainsAffiches(affiches: number, total: number, taille = TAILLE_PAGE): number {
  return Math.min(total, affiches + taille);
}
