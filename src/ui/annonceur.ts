// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const DELAI_ENTRE_ANNONCES_MS = 700;

/**
 * Zone « live » globale, invisible : annonce aux lecteurs d'écran les changements de page et de langue.
 * Les messages sont mis en file pour qu'une annonce n'écrase pas la précédente.
 */
class Annonceur {
  readonly element = document.createElement('div');
  private file: string[] = [];
  private enCours = false;

  constructor() {
    this.element.className = 'visuellement-cache annonceur';
    this.element.setAttribute('role', 'status');
    this.element.setAttribute('aria-live', 'polite');
    this.element.setAttribute('aria-atomic', 'true');
  }

  annoncer(message: string): void {
    if (message.trim() === '' || this.file.at(-1) === message) return;
    this.file.push(message);
    if (!this.enCours) this.suivant();
  }

  private suivant(): void {
    const message = this.file.shift();
    if (message === undefined) {
      this.enCours = false;
      return;
    }
    this.enCours = true;
    this.element.textContent = message;
    window.setTimeout(() => this.suivant(), DELAI_ENTRE_ANNONCES_MS);
  }
}

export const annonceur = new Annonceur();
export const annoncer = (message: string): void => annonceur.annoncer(message);
