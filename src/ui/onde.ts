// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Piste } from '../catalogue/schemas';
import { tv } from '../i18n';
import { formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';

export interface OptionsOnde {
  piste: Piste;
  /** Appelée quand l'utilisateur choisit une position (clic, glissement ou clavier). */
  surPosition: (secondes: number) => void;
  grande?: boolean;
}

function couleur(nom: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(nom).trim();
}

/**
 * Waveform d'une piste : canvas décoratif + curseur natif (input range) transparent par-dessus, qui
 * apporte le clic, le glissement, le clavier et les rôles ARIA. La partie lue se distingue par la
 * couleur ET par un trait vertical à la position courante.
 */
export function creerOnde({ piste, surPosition, grande = false }: OptionsOnde): HTMLElement {
  const racine = document.createElement('div');
  racine.className = grande ? 'onde onde-grande' : 'onde';

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const curseur = document.createElement('input');
  curseur.type = 'range';
  curseur.className = 'onde-curseur';
  curseur.min = '0';
  curseur.max = String(Math.max(1, Math.floor(piste.duree)));
  curseur.step = '1';
  curseur.value = '0';
  curseur.setAttribute('aria-label', tv('onde.position', { titre: piste.titre }));
  racine.append(canvas, curseur);

  const pics = piste.pics ?? [];

  function progression(): number {
    const etat = lecteur.etat();
    if (etat.piste?.id !== piste.id || piste.duree <= 0) return 0;
    return Math.min(1, Math.max(0, etat.position / piste.duree));
  }

  function dessiner(): void {
    const ratio = Math.min(window.devicePixelRatio || 1, 2);
    const largeur = Math.floor(racine.clientWidth * ratio);
    const hauteur = Math.floor(racine.clientHeight * ratio);
    if (largeur === 0 || hauteur === 0) return;
    if (canvas.width !== largeur || canvas.height !== hauteur) {
      canvas.width = largeur;
      canvas.height = hauteur;
    }
    const contexte = canvas.getContext('2d');
    if (contexte === null) return;
    contexte.clearRect(0, 0, largeur, hauteur);

    const lue = couleur('--onde-lue');
    const nonLue = couleur('--onde');
    const barres = pics.length > 0 ? pics : new Array<number>(60).fill(8);
    const avancement = progression();
    const pas = largeur / barres.length;
    const epaisseur = Math.max(1, pas - ratio);
    barres.forEach((pic, i) => {
      const h = Math.max(2 * ratio, (pic / 100) * hauteur);
      const x = i * pas;
      contexte.fillStyle = (i + 0.5) / barres.length <= avancement ? lue : nonLue;
      contexte.fillRect(x, (hauteur - h) / 2, epaisseur, h);
    });

    if (avancement > 0) {
      contexte.fillStyle = couleur('--texte');
      contexte.fillRect(Math.min(largeur - 2 * ratio, avancement * largeur), 0, 2 * ratio, hauteur);
    }
  }

  function actualiser(): void {
    if (!racine.isConnected) {
      lecteur.removeEventListener('etat', actualiser);
      observateur.disconnect();
      return;
    }
    const etat = lecteur.etat();
    const active = etat.piste?.id === piste.id;
    const position = active ? Math.min(etat.position, piste.duree) : 0;
    if (document.activeElement !== curseur || active) curseur.value = String(Math.floor(position));
    curseur.setAttribute(
      'aria-valuetext',
      `${formaterDuree(position)} / ${formaterDuree(piste.duree)}`,
    );
    dessiner();
  }

  curseur.addEventListener('input', () => surPosition(Number(curseur.value)));
  const observateur = new ResizeObserver(() => dessiner());
  observateur.observe(racine);
  lecteur.addEventListener('etat', actualiser);
  // Premier calcul de l'alternative textuelle ; le dessin attend la première mesure de taille.
  curseur.setAttribute('aria-valuetext', `${formaterDuree(0)} / ${formaterDuree(piste.duree)}`);
  return racine;
}
