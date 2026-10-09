// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/**
 * Types d'album. Défini hors de `schemas.ts` (qui dépend de zod) pour que les pages puissent l'utiliser
 * sans charger la bibliothèque de validation au démarrage.
 */
export const TYPES_ALBUM = ['single', 'ep', 'lp', 'compilation'] as const;
