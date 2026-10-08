// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Lecteur } from './lecteur';

const DECALAGE_SECONDES = 5;

/** Éléments qui gèrent eux-mêmes les touches (saisie, boutons, curseurs, liens, listes). */
function gereSesTouches(cible: EventTarget | null): boolean {
  return (
    cible instanceof HTMLElement &&
    cible.closest(
      'input, textarea, select, button, a, [contenteditable="true"], [role="slider"]',
    ) !== null
  );
}

/** Raccourcis clavier globaux : Espace (lecture/pause), flèches gauche/droite (±5 s), M (muet). */
export function installerRaccourcis(lecteur: Lecteur): void {
  window.addEventListener('keydown', (evenement) => {
    if (evenement.defaultPrevented || evenement.ctrlKey || evenement.metaKey || evenement.altKey) {
      return;
    }
    const cible = evenement.target;
    const touche = evenement.key.toLowerCase();

    // M est sans danger partout sauf dans un champ de saisie.
    if (touche === 'm') {
      if (cible instanceof HTMLElement && cible.closest('input, textarea, select') !== null) return;
      evenement.preventDefault();
      lecteur.basculerMuet();
      return;
    }

    if (gereSesTouches(cible)) return;
    if (evenement.key === ' ') {
      evenement.preventDefault();
      lecteur.basculer();
    } else if (evenement.key === 'ArrowLeft') {
      evenement.preventDefault();
      lecteur.sauter(-DECALAGE_SECONDES);
    } else if (evenement.key === 'ArrowRight') {
      evenement.preventDefault();
      lecteur.sauter(DECALAGE_SECONDES);
    }
  });
}
