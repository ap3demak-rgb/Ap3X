// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { element } from './dom';
import type { Progression } from './github';

export interface BarreProgression {
  /** Barre et texte d'état, à insérer dans la page. */
  element: HTMLElement;
  demarrer(): void;
  mettreAJour(avancement: Progression): void;
  /** Cache la barre et affiche `texte` (ou rien) dans la zone d'état. */
  terminer(texte?: string): void;
}

/** Barre d'envoi : pourcentage pondéré par la taille des fichiers, texte d'état annoncé aux lecteurs d'écran. */
export function creerProgression(): BarreProgression {
  const racine = element('div', 'admin-envoi');
  const barre = element('progress', 'admin-progression');
  barre.max = 100;
  barre.value = 0;
  barre.hidden = true;
  barre.setAttribute('aria-label', t('admin.nouvelle.envoi'));
  const etat = element('p', 'carte-meta');
  etat.setAttribute('role', 'status');
  racine.append(barre, etat);

  return {
    element: racine,
    demarrer() {
      barre.hidden = false;
      barre.value = 0;
      etat.textContent = tv('admin.nouvelle.envoi_pourcent', { n: 0 });
    },
    mettreAJour(avancement) {
      const pourcent =
        avancement.totalOctets === 0
          ? Math.round((avancement.fichiers / Math.max(1, avancement.totalFichiers)) * 100)
          : Math.round((avancement.octets / avancement.totalOctets) * 100);
      barre.value = pourcent;
      etat.textContent = tv('admin.nouvelle.envoi_pourcent', { n: pourcent });
    },
    terminer(texte = '') {
      barre.hidden = true;
      etat.textContent = texte;
    },
  };
}
