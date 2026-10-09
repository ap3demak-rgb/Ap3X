// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { formaterInstant } from './routeur';

export interface ParametresLien {
  /** Origine du site, par exemple `https://ap3demak-rgb.github.io`. */
  origine: string;
  /** Chemin de base du site, terminé par « / » (par exemple `/Ap3X/`). */
  base: string;
  type: 'piste' | 'album';
  id: string;
  /** Instant de départ en secondes (pistes seulement). */
  instant?: number | undefined;
  /**
   * En production, le lien pointe vers la page de partage générée au build (qui porte les balises
   * Open Graph puis redirige). En développement cette page n'existe pas : lien direct vers la route.
   */
  pagePartage: boolean;
}

/** Lien absolu à partager pour une piste ou un album. */
export function construireLienPartage(parametres: ParametresLien): string {
  const { origine, base, type, id, instant, pagePartage } = parametres;
  const identifiant = encodeURIComponent(id);
  const requete =
    type === 'piste' && instant !== undefined && instant > 0
      ? `?t=${formaterInstant(instant)}`
      : '';
  if (pagePartage) return `${origine}${base}partage/${type}/${identifiant}/${requete}`;
  return `${origine}${base}#/${type}/${identifiant}${requete}`;
}

/** Copie un texte dans le presse-papiers ; renvoie `false` si le navigateur refuse. */
export async function copierTexte(texte: string): Promise<boolean> {
  try {
    if (navigator.clipboard !== undefined) {
      await navigator.clipboard.writeText(texte);
      return true;
    }
  } catch {
    // Contexte non sécurisé ou permission refusée : repli ci-dessous.
  }
  // Repli pour les navigateurs sans API Clipboard : sélection d'un champ temporaire.
  const champ = document.createElement('textarea');
  champ.value = texte;
  champ.setAttribute('readonly', '');
  champ.style.position = 'fixed';
  champ.style.opacity = '0';
  document.body.append(champ);
  champ.select();
  try {
    return document.execCommand('copy');
  } catch {
    return false;
  } finally {
    champ.remove();
  }
}

/** Lien de partage de la page courante de l'application. */
export function lienPourCetteApplication(
  type: 'piste' | 'album',
  id: string,
  instant?: number,
): string {
  return construireLienPartage({
    origine: window.location.origin,
    base: import.meta.env.BASE_URL,
    type,
    id,
    instant,
    pagePartage: import.meta.env.PROD,
  });
}
