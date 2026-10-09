// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const CLE_PISTES = 'ap3x.favoris';
const CLE_ALBUMS = 'ap3x.favoris.albums';

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

/**
 * Éléments « aimés » du visiteur (pistes ou albums selon la clé de stockage), conservés dans le
 * navigateur (localStorage). Événement : `change` à chaque modification, y compris venant d'un autre onglet.
 */
export class Favoris extends EventTarget {
  private ids: string[] = [];
  private readonly stockage: Stockage | undefined;
  readonly cle: string;

  constructor(stockage?: Stockage, cle: string = CLE_PISTES) {
    super();
    this.stockage = stockage;
    this.cle = cle;
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
      const brut = this.stockage?.getItem(this.cle);
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
      this.stockage?.setItem(this.cle, JSON.stringify(this.ids));
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

/** Pistes aimées et albums aimés de l'application, synchronisés entre les onglets. */
export const favoris = new Favoris(stockageLocal(), CLE_PISTES);
export const favorisAlbums = new Favoris(stockageLocal(), CLE_ALBUMS);
window.addEventListener('storage', (evenement) => {
  if (evenement.key === CLE_PISTES || evenement.key === null) favoris.recharger();
  if (evenement.key === CLE_ALBUMS || evenement.key === null) favorisAlbums.recharger();
});
