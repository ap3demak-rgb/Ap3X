// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { PerspectiveCamera, Scene } from 'three';

/** Contenu 3D d'une fenêtre : le moteur le rend dans la vue partagée puis copie l'image dans un canvas 2D de la page. */
export interface VueFenetre {
  scene: Scene;
  camera: PerspectiveCamera;
  /** Appelée avec la taille CSS de la fenêtre. */
  redimensionner(largeur: number, hauteur: number): void;
  mettreAJour(secondes: number, delta: number): void;
  /** Position du pointeur dans la fenêtre, de -1 à 1 (facultatif). */
  pointeur?(x: number, y: number): void;
  /** Libère géométries, matériaux et textures. */
  dispose(): void;
}

/** Données lues par les vues à chaque image. */
export interface SourcesVue {
  /** Spectre lissé (0 à 1) et niveau global. */
  spectre: Float32Array;
  niveau(): number;
  /** Pics (0 à 100) de la piste active et part déjà lue (0 à 1). */
  piste(): { pics: readonly number[]; progression: number };
}
