// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { lecteur, elementAudio } from '../lecteur';
import { reglages } from '../site/reglages';
import { bandeau } from '../ui/bandeau';
import { Analyseur } from './analyseur';
import type { DemandeFenetre, Moteur } from './moteur';
import type { SourcesVue } from './vue';

/**
 * Point d'entrée du rendu 3D, volontairement sans dépendance à Three.js : le moteur est chargé à la
 * demande (import dynamique) une fois l'interface affichée.
 */

export type DemandeFenetrePage = { canvas: HTMLCanvasElement } & { type: 'pochette'; url: string };

interface DemandeEnAttente {
  demande: DemandeFenetre;
  surActive: () => void;
  surEchec: () => void;
}

const analyseur = new Analyseur(elementAudio);
const mouvementReduit = window.matchMedia('(prefers-reduced-motion: reduce)');

/** Pas d'animation : demande du visiteur (mouvement réduit) ou réglage du site (`fond.actif`). */
const sansAnimation = (): boolean => mouvementReduit.matches || !reglages.fond.actif;

const sources: SourcesVue = {
  spectre: analyseur.spectre,
  niveau: () => analyseur.niveau,
  piste: () => {
    const etat = lecteur.etat();
    const pics = etat.piste?.pics ?? [];
    const progression = etat.piste !== undefined && etat.duree > 0 ? etat.position / etat.duree : 0;
    return { pics, progression: Math.min(1, Math.max(0, progression)) };
  },
};

let moteur: Moteur | undefined;
let demarre = false;
let enAttente: DemandeEnAttente[] = [];
let boucleCss = 0;
const actives = new Set<DemandeEnAttente>();

function activerAnalyse(): void {
  void analyseur.activer();
}

/** Repli sans WebGL : une barre de niveau en CSS, mise à jour tant que la page est visible. */
function demarrerRepliCss(): void {
  if (!reglages.fond.visualiseur) return;
  bandeau.definirMode('css');
  const image = (): void => {
    boucleCss = requestAnimationFrame(image);
    analyseur.mettreAJour();
    bandeau.definirNiveau(analyseur.niveau * 2);
  };
  boucleCss = requestAnimationFrame(image);
}

function arreterRepliCss(): void {
  cancelAnimationFrame(boucleCss);
  bandeau.definirNiveau(0);
}

function abandonnerRendu3d(): void {
  arreterRepliCss();
  moteur?.dispose();
  moteur = undefined;
  bandeau.definirMode('cache');
  for (const demande of actives) demande.surEchec();
  actives.clear();
}

async function activerFenetre(demande: DemandeEnAttente): Promise<void> {
  if (moteur === undefined) return;
  try {
    await moteur.ajouterFenetre(demande.demande);
    actives.add(demande);
    demande.surActive();
  } catch (erreur) {
    console.warn('Fenêtre 3D non affichée :', erreur);
    demande.surEchec();
  }
}

async function lancer(): Promise<void> {
  if (sansAnimation()) {
    // Mouvement réduit : fond statique (dégradé CSS), ni visualiseur ni pochette animée.
    bandeau.definirMode('cache');
    return;
  }
  elementAudio.addEventListener('play', activerAnalyse);
  const { Moteur: ClasseMoteur } = await import('./moteur');
  if (sansAnimation()) return;
  const instance = ClasseMoteur.creer({
    sources,
    surPerte: () => {
      console.warn('Contexte WebGL perdu : retour au rendu simple.');
      abandonnerRendu3d();
      demarrerRepliCss();
    },
  });
  if (instance === undefined) {
    demarrerRepliCss();
    for (const demande of enAttente) demande.surEchec();
    enAttente = [];
    return;
  }
  moteur = instance;
  document.body.prepend(instance.canvas);
  instance.demarrer();
  if (reglages.fond.visualiseur) {
    bandeau.definirMode('webgl');
    void instance
      .ajouterFenetre({ canvas: bandeau.canvas, type: 'visualiseur' })
      .catch((erreur: unknown) => {
        console.warn('Visualiseur non affiché :', erreur);
        bandeau.definirMode('css');
        demarrerRepliCss();
      });
  } else {
    bandeau.definirMode('cache');
  }
  const demandes = enAttente;
  enAttente = [];
  await Promise.all(demandes.map(activerFenetre));
}

function arreter(): void {
  elementAudio.removeEventListener('play', activerAnalyse);
  abandonnerRendu3d();
  for (const demande of enAttente) demande.surEchec();
  enAttente = [];
}

/** Charge et démarre le rendu 3D (fond animé, visualiseur) ; à appeler une fois l'interface affichée. */
export function demarrerRendu3d(): void {
  if (demarre) return;
  demarre = true;
  void lancer();
  mouvementReduit.addEventListener('change', () => {
    if (sansAnimation()) {
      arreter();
    } else {
      void lancer();
    }
  });
}

/**
 * Demande l'affichage d'un rendu 3D dans un canvas de la page. `surActive` est appelée quand le rendu
 * est prêt ; `surEchec` si le rendu 3D n'est pas disponible (la page garde alors son alternative plane).
 */
export function fenetre3d(
  demande: DemandeFenetrePage,
  surActive: () => void,
  surEchec: () => void,
): void {
  const entree: DemandeEnAttente = { demande, surActive, surEchec };
  if (sansAnimation()) return;
  if (moteur !== undefined) void activerFenetre(entree);
  else enAttente.push(entree);
}
