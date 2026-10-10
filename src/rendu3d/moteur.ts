// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { WebGLRenderer } from 'three';
import { intervalleImages, suivreBatterie } from './cadence';
import { reglages } from '../site/reglages';
import { Fond } from './fond';
import { creerPochette3d } from './pochette3d';
import type { SourcesVue, VueFenetre } from './vue';
import { creerVisualiseur } from './visualiseur';

/** Résolution maximale du rendu : au-delà, le gain visuel ne justifie pas le coût sur GPU modestes. */
const RATIO_MAX = 1.5;

export type DemandeFenetre =
  | { canvas: HTMLCanvasElement; type: 'visualiseur' }
  | { canvas: HTMLCanvasElement; type: 'pochette'; url: string };

interface FenetreActive {
  canvas: HTMLCanvasElement;
  contexte: CanvasRenderingContext2D;
  vue: VueFenetre;
  /** Taille CSS courante. */
  largeur: number;
  hauteur: number;
  visible: boolean;
  nettoyer: () => void;
}

export interface OptionsMoteur {
  sources: SourcesVue;
  /** Appelée si le contexte WebGL est perdu : le rendu 3D n'est alors plus disponible. */
  surPerte: () => void;
}

/**
 * Moteur de rendu : une seule instance WebGL pour tout le site. Elle dessine le fond animé sur un
 * canvas plein écran derrière la page, et rend les « fenêtres » (visualiseur, pochette) dans une zone
 * de ce même canvas avant de copier l'image dans un canvas 2D placé dans la page.
 */
export class Moteur {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly fond = new Fond();
  private readonly fenetres = new Set<FenetreActive>();
  private readonly options: OptionsMoteur;
  private readonly tactile = window.matchMedia('(pointer: coarse)').matches;
  private identifiantImage = 0;
  private dernierImage = 0;
  private origine = 0;
  private batterieFaible = false;
  private enMarche = false;
  private libere = false;

  private constructor(renderer: WebGLRenderer, options: OptionsMoteur) {
    this.renderer = renderer;
    this.options = options;
    this.canvas = renderer.domElement;
    this.canvas.className = 'fond-3d';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.redimensionner();
    suivreBatterie((faible) => {
      this.batterieFaible = faible;
    });
    window.addEventListener('resize', this.redimensionner);
    document.addEventListener('visibilitychange', this.surVisibilite);
    this.canvas.addEventListener('webglcontextlost', this.surPerteContexte);
  }

  /** Crée le moteur, ou renvoie `undefined` si WebGL n'est pas disponible. */
  static creer(options: OptionsMoteur): Moteur | undefined {
    try {
      const renderer = new WebGLRenderer({
        antialias: false,
        alpha: false,
        powerPreference: 'low-power',
      });
      if (renderer.getContext().isContextLost()) {
        renderer.dispose();
        return undefined;
      }
      return new Moteur(renderer, options);
    } catch {
      return undefined;
    }
  }

  /** Démarre la boucle d'animation. */
  demarrer(): void {
    if (this.enMarche || this.libere || document.hidden) return;
    this.enMarche = true;
    this.dernierImage = performance.now();
    this.identifiantImage = requestAnimationFrame(this.image);
  }

  arreter(): void {
    this.enMarche = false;
    cancelAnimationFrame(this.identifiantImage);
  }

  /** Ajoute une fenêtre ; le canvas 2D reçoit l'image 3D. Lève une erreur si la vue ne peut pas être créée. */
  async ajouterFenetre(demande: DemandeFenetre): Promise<void> {
    const vue =
      demande.type === 'visualiseur'
        ? creerVisualiseur(this.options.sources)
        : await creerPochette3d(demande.url);
    const contexte = demande.canvas.getContext('2d');
    if (this.libere || contexte === null) {
      vue.dispose();
      throw new Error('Fenêtre 3D indisponible');
    }

    const fenetre: FenetreActive = {
      canvas: demande.canvas,
      contexte,
      vue,
      largeur: 0,
      hauteur: 0,
      visible: true,
      nettoyer: () => undefined,
    };
    const mesurer = (): void => {
      const ratio = this.renderer.getPixelRatio();
      fenetre.largeur = Math.min(demande.canvas.clientWidth, window.innerWidth);
      fenetre.hauteur = Math.min(demande.canvas.clientHeight, window.innerHeight);
      demande.canvas.width = Math.max(1, Math.round(fenetre.largeur * ratio));
      demande.canvas.height = Math.max(1, Math.round(fenetre.hauteur * ratio));
      if (fenetre.largeur > 0 && fenetre.hauteur > 0)
        vue.redimensionner(fenetre.largeur, fenetre.hauteur);
    };
    const observateurTaille = new ResizeObserver(mesurer);
    observateurTaille.observe(demande.canvas);
    const observateurVisibilite = new IntersectionObserver((entrees) => {
      fenetre.visible = entrees.some((entree) => entree.isIntersecting);
    });
    observateurVisibilite.observe(demande.canvas);

    const surDeplacement = (evenement: PointerEvent): void => {
      const boite = demande.canvas.getBoundingClientRect();
      vue.pointeur?.(
        ((evenement.clientX - boite.left) / Math.max(1, boite.width)) * 2 - 1,
        ((evenement.clientY - boite.top) / Math.max(1, boite.height)) * 2 - 1,
      );
    };
    const surSortie = (): void => vue.pointeur?.(Number.NaN, Number.NaN);
    if (vue.pointeur !== undefined) {
      demande.canvas.addEventListener('pointermove', surDeplacement);
      demande.canvas.addEventListener('pointerleave', surSortie);
    }

    fenetre.nettoyer = () => {
      observateurTaille.disconnect();
      observateurVisibilite.disconnect();
      demande.canvas.removeEventListener('pointermove', surDeplacement);
      demande.canvas.removeEventListener('pointerleave', surSortie);
      vue.dispose();
    };
    mesurer();
    this.fenetres.add(fenetre);
    // Première image tout de suite, pour ne pas afficher une fenêtre vide.
    this.rendreFenetre(fenetre, 0, 0);
  }

  /** Libère toutes les ressources GPU et retire le canvas. */
  dispose(): void {
    if (this.libere) return;
    this.libere = true;
    this.arreter();
    window.removeEventListener('resize', this.redimensionner);
    document.removeEventListener('visibilitychange', this.surVisibilite);
    this.canvas.removeEventListener('webglcontextlost', this.surPerteContexte);
    for (const fenetre of this.fenetres) fenetre.nettoyer();
    this.fenetres.clear();
    this.fond.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  private readonly redimensionner = (): void => {
    const ratio = Math.min(window.devicePixelRatio || 1, RATIO_MAX);
    this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(window.innerWidth, window.innerHeight, false);
    this.fond.redimensionner(window.innerWidth, window.innerHeight);
  };

  private readonly surVisibilite = (): void => {
    if (document.hidden) this.arreter();
    else this.demarrer();
  };

  private readonly surPerteContexte = (evenement: Event): void => {
    evenement.preventDefault();
    this.options.surPerte();
  };

  private readonly image = (maintenant: number): void => {
    if (!this.enMarche) return;
    this.identifiantImage = requestAnimationFrame(this.image);
    const intervalle = intervalleImages({
      tactile: this.tactile,
      batterieFaible: this.batterieFaible,
    });
    if (maintenant - this.dernierImage < intervalle) return;
    const delta = Math.min(0.1, (maintenant - this.dernierImage) / 1000);
    this.dernierImage = maintenant;
    if (this.origine === 0) this.origine = maintenant;
    const secondes = (maintenant - this.origine) / 1000;

    // Les fenêtres sont rendues d'abord, puis le fond : l'image finale du canvas est le fond seul.
    for (const fenetre of [...this.fenetres]) {
      if (!fenetre.canvas.isConnected) {
        fenetre.nettoyer();
        this.fenetres.delete(fenetre);
      } else if (fenetre.visible) {
        this.rendreFenetre(fenetre, secondes, delta);
      }
    }
    this.renderer.setScissorTest(false);
    this.renderer.setViewport(0, 0, window.innerWidth, window.innerHeight);
    this.fond.mettreAJour(secondes * reglages.fond.vitesse, this.options.sources.niveau());
    this.renderer.render(this.fond.scene, this.fond.camera);
  };

  private rendreFenetre(fenetre: FenetreActive, secondes: number, delta: number): void {
    const { largeur, hauteur } = fenetre;
    if (largeur === 0 || hauteur === 0) return;
    const ratio = this.renderer.getPixelRatio();
    fenetre.vue.mettreAJour(secondes, delta);
    this.renderer.setScissorTest(true);
    this.renderer.setViewport(0, 0, largeur, hauteur);
    this.renderer.setScissor(0, 0, largeur, hauteur);
    this.renderer.render(fenetre.vue.scene, fenetre.vue.camera);
    const w = Math.round(largeur * ratio);
    const h = Math.round(hauteur * ratio);
    // L'origine de WebGL est en bas à gauche : on copie la zone du bas du canvas partagé.
    fenetre.contexte.drawImage(this.canvas, 0, this.canvas.height - h, w, h, 0, 0, w, h);
    this.renderer.setScissorTest(false);
  }
}
