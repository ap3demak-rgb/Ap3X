// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { slugifier } from './outils.ts';

/** Identifiants de pages spéciales : aucune catégorie (dossier) ne peut porter ces noms. */
export const CATEGORIES_RESERVEES = ['tout', 'favoris'] as const;

export interface DemandeCategories {
  /** Catégorie du dossier de la piste. */
  principale: string;
  /** Catégories demandées dans la fiche (nom ou identifiant). */
  demandees: readonly string[];
  /** Genres lus dans les tags ID3. */
  genres: readonly string[];
  /** Identifiants des catégories existantes (dossiers). */
  connues: ReadonlySet<string>;
}

export interface CategoriesResolues {
  /** Catégories supplémentaires existantes, sans doublon, sans la catégorie principale. */
  slugs: string[];
  /** Catégories demandées par la fiche mais inexistantes (à signaler). */
  inconnues: string[];
}

/**
 * Une piste appartient à la catégorie de son dossier et peut en rejoindre d'autres, via sa fiche
 * (`categories`) ou son genre ID3. Seules les catégories existantes sont retenues : une catégorie
 * inconnue de la fiche est signalée, un genre inconnu est simplement ignoré.
 */
export function categoriesSupplementaires(demande: DemandeCategories): CategoriesResolues {
  const slugs = new Set<string>();
  const inconnues: string[] = [];
  for (const nom of demande.demandees) {
    const slug = slugifier(nom);
    if (demande.connues.has(slug)) slugs.add(slug);
    else inconnues.push(nom);
  }
  for (const genre of demande.genres) {
    const slug = slugifier(genre);
    if (demande.connues.has(slug)) slugs.add(slug);
  }
  slugs.delete(demande.principale);
  return { slugs: [...slugs], inconnues };
}
