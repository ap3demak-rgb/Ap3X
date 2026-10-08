// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const CLE_STOCKAGE = 'ap3x.favoris';

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Pistes « aimées » du visiteur, conservées dans le navigateur (localStorage).
 * Événement : `change` à chaque modification, y compris venant d'un autre onglet.
 */
export class Favoris extends EventTarget {
  private ids: string[] = [];
  private readonly stockage: Stockage | undefined;

  constructor(stockage?: Stockage) {
    super();
    this.stockage = stockage;
    this.recharger(false);
  }

  estFavori(id: string): boolean {
    return this.ids.includes(id);
  }

  /** Ajoute ou retire un favori ; renvoie le nouvel état (`true` = aimé). */
  basculer(id: string): boolean {
    const aime = !this.estFavori(id);
    this.ids = aime ? [...this.ids, id] : this.ids.filter((autre) => autre !== id);
    this.enregistrer();
    this.dispatchEvent(new Event('change'));
    return aime;
  }

  /** Identifiants dans l'ordre où ils ont été aimés (le plus récent en dernier). */
  liste(): readonly string[] {
    return this.ids;
  }

  /** Relit le stockage (par exemple après une modification dans un autre onglet). */
  recharger(notifier = true): void {
    try {
      const brut = this.stockage?.getItem(CLE_STOCKAGE);
      const lu: unknown = brut === null || brut === undefined ? [] : JSON.parse(brut);
      this.ids = Array.isArray(lu)
        ? [...new Set(lu.filter((valeur): valeur is string => typeof valeur === 'string'))]
        : [];
    } catch {
      this.ids = [];
    }
    if (notifier) this.dispatchEvent(new Event('change'));
  }

  private enregistrer(): void {
    try {
      this.stockage?.setItem(CLE_STOCKAGE, JSON.stringify(this.ids));
    } catch {
      // Stockage indisponible : les favoris ne durent que le temps de la visite.
    }
  }
}

function stockageLocal(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Favoris de l'application, synchronisés entre les onglets. */
export const favoris = new Favoris(stockageLocal());
window.addEventListener('storage', (evenement) => {
  if (evenement.key === CLE_STOCKAGE || evenement.key === null) favoris.recharger();
});
