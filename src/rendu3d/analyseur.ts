// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Nombre de bandes de fréquences exposées au visualiseur. */
export const NOMBRE_BANDES = 64;

/** Part de la valeur précédente conservée à chaque image : adoucit les variations (pas de scintillement). */
const LISSAGE = 0.8;

/**
 * Analyse en temps réel du son de l'élément audio principal (Web Audio, AnalyserNode).
 * Le graphe audio n'est branché qu'une fois le contexte démarré avec succès ; sinon l'élément audio
 * continue de jouer normalement, sans analyse.
 */
export class Analyseur {
  /** Spectre lissé, valeurs de 0 à 1. */
  readonly spectre = new Float32Array(NOMBRE_BANDES);
  /** Niveau global lissé, de 0 à 1. */
  niveau = 0;
  actif = false;

  private contexte: AudioContext | undefined;
  private analyseur: AnalyserNode | undefined;
  private brut: Uint8Array<ArrayBuffer> = new Uint8Array(NOMBRE_BANDES);
  private tentative = false;
  private readonly audio: HTMLAudioElement;

  constructor(audio: HTMLAudioElement) {
    this.audio = audio;
  }

  /** À appeler depuis un événement de lecture, c'est-à-dire après une action de l'utilisateur. */
  async activer(): Promise<void> {
    if (this.tentative) {
      if (this.contexte?.state === 'suspended') await this.contexte.resume();
      return;
    }
    this.tentative = true;
    try {
      const Contexte = window.AudioContext;
      const contexte = new Contexte();
      await contexte.resume();
      if (contexte.state !== 'running') {
        await contexte.close();
        return;
      }
      const analyseur = contexte.createAnalyser();
      analyseur.fftSize = NOMBRE_BANDES * 2;
      analyseur.smoothingTimeConstant = 0.5;
      const source = contexte.createMediaElementSource(this.audio);
      source.connect(analyseur);
      analyseur.connect(contexte.destination);
      this.contexte = contexte;
      this.analyseur = analyseur;
      this.brut = new Uint8Array(analyseur.frequencyBinCount);
      this.actif = true;
    } catch (erreur) {
      console.warn('Analyse audio indisponible :', erreur);
    }
  }

  /** Met à jour `spectre` et `niveau` ; sans lecture ou sans analyse, les valeurs retombent à zéro. */
  mettreAJour(): void {
    const enLecture = this.actif && !this.audio.paused;
    if (enLecture && this.analyseur !== undefined) {
      this.analyseur.getByteFrequencyData(this.brut);
    }
    let somme = 0;
    for (let i = 0; i < NOMBRE_BANDES; i += 1) {
      const cible = enLecture ? (this.brut[i] ?? 0) / 255 : 0;
      const lisse = (this.spectre[i] ?? 0) * LISSAGE + cible * (1 - LISSAGE);
      this.spectre[i] = lisse;
      somme += lisse;
    }
    this.niveau = somme / NOMBRE_BANDES;
  }
}
