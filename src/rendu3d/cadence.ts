// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Cadence maximale quand il faut économiser l'énergie : mobiles et batterie faible. */
export const IMAGES_PAR_SECONDE_ECONOMIE = 30;
/** Seuil de batterie faible (20 %), hors charge. */
export const SEUIL_BATTERIE_FAIBLE = 0.2;

export interface ContrainteCadence {
  /** Écran tactile principal (mobile, tablette). */
  tactile: boolean;
  /** Batterie sous le seuil et débranchée. */
  batterieFaible: boolean;
}

/**
 * Délai minimal entre deux images, en millisecondes. 0 = aucune limite (la cadence suit l'écran,
 * 60 images/s sur ordinateur) ; 30 images/s sur mobile et sur batterie faible.
 */
export function intervalleImages({ tactile, batterieFaible }: ContrainteCadence): number {
  return tactile || batterieFaible ? 1000 / IMAGES_PAR_SECONDE_ECONOMIE : 0;
}

/** Vrai si la batterie est faible et ne charge pas. */
export function estBatterieFaible(niveau: number, enCharge: boolean): boolean {
  return !enCharge && niveau < SEUIL_BATTERIE_FAIBLE;
}

/** Sous-ensemble de l'API Battery Status (Chromium) dont on a besoin. */
interface GestionnaireBatterie extends EventTarget {
  level: number;
  charging: boolean;
}

/**
 * Suit l'état de la batterie quand le navigateur l'expose (Chromium) et appelle `surChangement` à
 * chaque changement. Sans API, la batterie est considérée comme suffisante.
 */
export function suivreBatterie(surChangement: (faible: boolean) => void): void {
  const navigateur = navigator as Navigator & { getBattery?: () => Promise<GestionnaireBatterie> };
  if (navigateur.getBattery === undefined) return;
  navigateur
    .getBattery()
    .then((batterie) => {
      const actualiser = (): void =>
        surChangement(estBatterieFaible(batterie.level, batterie.charging));
      actualiser();
      batterie.addEventListener('levelchange', actualiser);
      batterie.addEventListener('chargingchange', actualiser);
    })
    .catch(() => undefined);
}
