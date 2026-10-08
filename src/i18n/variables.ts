// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Remplace les variables `{nom}` d'un texte ; une variable inconnue est laissée telle quelle. */
export function remplacerVariables(
  texte: string,
  variables: Readonly<Record<string, string | number>>,
): string {
  return texte.replace(/\{(\w+)\}/g, (correspondance: string, nom: string) =>
    Object.hasOwn(variables, nom) ? String(variables[nom]) : correspondance,
  );
}
