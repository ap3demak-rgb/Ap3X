// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const ESPACE_NOMS = 'http://www.w3.org/2000/svg';

/** Tracés (viewBox 24×24) des icônes de la barre de lecture. */
export const TRACES = {
  lecture: 'M8 5v14l11-7z',
  pause: 'M6 5h4v14H6zM14 5h4v14h-4z',
  precedent: 'M6 6h2v12H6zM9.5 12l8.5 6V6z',
  suivant: 'M16 6h2v12h-2zM6 18l8.5-6L6 6z',
  aleatoire:
    'M10.59 9.17L5.41 4 4 5.41l5.17 5.17 1.42-1.41zM14.5 4l2.04 2.04L4 18.59 5.41 20 17.96 7.46 20 9.5V4h-5.5zm.33 9.41l-1.41 1.41 3.13 3.13L14.5 20H20v-5.5l-2.04 2.04-3.13-3.13z',
  repetition: 'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4z',
  repetitionPiste:
    'M7 7h10v3l4-4-4-4v3H5v6h2V7zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4zm-4-2V9h-1l-2 1v1h1.5v4H13z',
  volume:
    'M3 9v6h4l5 5V4L7 9H3zm13.5 3A4.5 4.5 0 0014 7.97v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z',
  muet: 'M16.5 12A4.5 4.5 0 0014 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.8 8.8 0 0021 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 003.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z',
  file: 'M3 6h14v2H3zm0 5h14v2H3zm0 5h9v2H3zm13-1v6l5-3z',
  monter: 'M7 14l5-5 5 5z',
  descendre: 'M7 10l5 5 5-5z',
  retirer:
    'M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z',
} as const;

export type NomIcone = keyof typeof TRACES;

/** Crée une icône SVG décorative (le libellé accessible est porté par le bouton). */
export function icone(nom: NomIcone): SVGSVGElement {
  const svg = document.createElementNS(ESPACE_NOMS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('width', '24');
  svg.setAttribute('height', '24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const chemin = document.createElementNS(ESPACE_NOMS, 'path');
  chemin.setAttribute('d', TRACES[nom]);
  chemin.setAttribute('fill', 'currentColor');
  svg.append(chemin);
  return svg;
}

export function changerIcone(bouton: HTMLElement, nom: NomIcone): void {
  bouton.replaceChildren(icone(nom));
}
