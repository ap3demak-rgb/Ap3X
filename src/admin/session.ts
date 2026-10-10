// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const CLE = 'ap3x.admin.jeton';

type Stockage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

export interface Stockages {
  session: Stockage;
  local: Stockage;
}

/** Stockages du navigateur ; indisponibles (navigation privée, accès bloqué) : `undefined`. */
function stockagesNavigateur(): Stockages | undefined {
  try {
    return { session: window.sessionStorage, local: window.localStorage };
  } catch {
    return undefined;
  }
}

/** Jeton mémorisé : celui de l'onglet d'abord, puis celui gardé sur l'appareil. */
export function lireJeton(
  stockages: Stockages | undefined = stockagesNavigateur(),
): string | undefined {
  if (stockages === undefined) return undefined;
  try {
    return stockages.session.getItem(CLE) ?? stockages.local.getItem(CLE) ?? undefined;
  } catch {
    return undefined;
  }
}

export function effacerJeton(stockages: Stockages | undefined = stockagesNavigateur()): void {
  if (stockages === undefined) return;
  try {
    stockages.session.removeItem(CLE);
    stockages.local.removeItem(CLE);
  } catch {
    // Rien à effacer si le stockage est inaccessible.
  }
}

/**
 * Mémorise le jeton pour l'onglet (`sessionStorage`) ou, si `resterConnecte`, pour l'appareil
 * (`localStorage`). Un seul des deux contient le jeton.
 */
export function enregistrerJeton(
  jeton: string,
  resterConnecte: boolean,
  stockages: Stockages | undefined = stockagesNavigateur(),
): void {
  if (stockages === undefined) return;
  effacerJeton(stockages);
  try {
    (resterConnecte ? stockages.local : stockages.session).setItem(CLE, jeton);
  } catch {
    // Stockage plein ou refusé : le jeton devra être ressaisi à la prochaine visite.
  }
}

/** Vrai si le jeton est gardé sur l'appareil (case « rester connecté »). */
export function jetonSurAppareil(
  stockages: Stockages | undefined = stockagesNavigateur(),
): boolean {
  if (stockages === undefined) return false;
  try {
    return stockages.local.getItem(CLE) !== null;
  } catch {
    return false;
  }
}

/** Jeton nettoyé (espaces ou retours à la ligne collés avec lui) ; `undefined` s'il est vide ou contient un espace. */
export function nettoyerJeton(saisie: string): string | undefined {
  const jeton = saisie.trim();
  return jeton === '' || /\s/.test(jeton) ? undefined : jeton;
}
