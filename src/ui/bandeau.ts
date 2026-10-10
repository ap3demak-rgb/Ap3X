// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { reglages } from '../site/reglages';

export type ModeBandeau = 'cache' | 'reserve' | 'webgl' | 'css';

/**
 * Bandeau décoratif du visualiseur, placé entre l'en-tête et le contenu. Il est créé une seule fois
 * et réinséré à chaque affichage de page : le canvas garde ainsi son contexte et ses dimensions.
 * - `reserve` : en attendant le chargement du rendu 3D, la zone est déjà là (vide) pour que la page
 *   ne bouge pas quand le visualiseur apparaît ;
 * - `webgl` : le canvas reçoit le rendu 3D ;
 * - `css` : repli sans WebGL, une simple barre de niveau ;
 * - `cache` : mouvement réduit ou rendu indisponible.
 */
class Bandeau {
  readonly element = document.createElement('div');
  readonly canvas = document.createElement('canvas');
  private readonly niveau = document.createElement('div');
  private readonly barre = document.createElement('div');

  constructor() {
    this.element.className = 'visualiseur';
    this.element.setAttribute('aria-hidden', 'true');
    this.canvas.className = 'visualiseur-canvas';
    this.niveau.className = 'niveau-css';
    this.barre.className = 'niveau-barre';
    this.niveau.append(this.barre);
    this.element.append(this.canvas, this.niveau);
    // Mouvement réduit : jamais de visualiseur, donc aucune zone à réserver.
    const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const masque = mouvementReduit || !reglages.fond.actif || !reglages.fond.visualiseur;
    this.definirMode(masque ? 'cache' : 'reserve');
  }

  definirMode(mode: ModeBandeau): void {
    this.element.hidden = mode === 'cache';
    this.canvas.hidden = mode !== 'webgl';
    this.niveau.hidden = mode !== 'css';
  }

  /** Niveau sonore de 0 à 1 pour le repli CSS. */
  definirNiveau(niveau: number): void {
    this.barre.style.transform = `scaleX(${Math.min(1, Math.max(0, niveau))})`;
  }
}

export const bandeau = new Bandeau();
