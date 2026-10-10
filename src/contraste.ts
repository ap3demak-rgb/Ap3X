// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Calcul des ratios de contraste WCAG 2.x (luminance relative sRGB). */

export interface Rgb {
  r: number;
  g: number;
  b: number;
}

export function analyserCouleur(hex: string): Rgb {
  const correspondance = /^#([0-9a-f]{6})$/i.exec(hex.trim());
  if (correspondance?.[1] === undefined) {
    throw new Error(`Couleur #RRGGBB attendue : « ${hex} »`);
  }
  const entier = Number.parseInt(correspondance[1], 16);
  return { r: (entier >> 16) & 255, g: (entier >> 8) & 255, b: entier & 255 };
}

function lineaire(canal: number): number {
  const c = canal / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

export function luminance(couleur: Rgb): number {
  return 0.2126 * lineaire(couleur.r) + 0.7152 * lineaire(couleur.g) + 0.0722 * lineaire(couleur.b);
}

export function ratioContraste(a: string, b: string): number {
  const la = luminance(analyserCouleur(a));
  const lb = luminance(analyserCouleur(b));
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

/** Seuils WCAG 2.2 niveau AAA. */
export const SEUILS = {
  /** Texte normal, texte secondaire, liens, hashtags (critère 1.4.6). */
  texte: 7,
  /** Grand texte : au moins 24 px, ou 19 px en gras (critère 1.4.6). */
  grandTexte: 4.5,
  /** Composants d'interface et objets graphiques (critère 1.4.11). */
  composant: 3,
} as const;
