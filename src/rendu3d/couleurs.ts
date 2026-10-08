// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Lit un jeton couleur #RRGGBB du thème (source unique des couleurs : src/styles/theme.css). */
export function jetonCouleur(nom: string): string {
  const valeur = getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
  if (!/^#[0-9a-f]{6}$/i.test(valeur)) {
    throw new Error(`Jeton de couleur ${nom} absent ou invalide : « ${valeur} »`);
  }
  return valeur;
}

/** Composantes sRGB (0 à 1) d'un jeton, pour des shaders qui écrivent directement en sRGB. */
export function jetonSrgb(nom: string): [number, number, number] {
  const entier = Number.parseInt(jetonCouleur(nom).slice(1), 16);
  return [((entier >> 16) & 255) / 255, ((entier >> 8) & 255) / 255, (entier & 255) / 255];
}
