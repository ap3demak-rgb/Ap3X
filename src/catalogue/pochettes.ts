// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Album, Categorie, Piste } from './schemas';

/** Dimensions maximales (en pixels) des déclinaisons de pochettes produites au build. */
export const TAILLE_MINIATURE = 320;
export const TAILLE_GRANDE = 960;
export const TAILLE_PARTAGE = 1200;

/**
 * Image d'aperçu des liens de partage (Open Graph) : un JPEG, format accepté par tous les réseaux,
 * à côté de la grande pochette WebP (`pochettes/<empreinte>.webp` devient `pochettes/<empreinte>-og.jpg`).
 */
export function cheminImagePartage(pochette: string): string {
  return pochette.replace(/\.webp$/, '-og.jpg');
}

/** Chemin à utiliser pour un affichage de petite taille (cartes, barre de lecture, listes). */
export function pochetteReduite(element: Piste | Album | Categorie): string | undefined {
  return element.miniature ?? element.pochette;
}
