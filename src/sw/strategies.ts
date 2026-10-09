// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/**
 * Règles du service worker, sans aucune dépendance au navigateur : elles sont testées à part et
 * embarquées dans `sw.js` au build.
 */

export const PREFIXE_CACHE = 'ap3x-';

export type Strategie =
  /** Le service worker ne s'en mêle pas : la requête part au réseau. */
  | 'ignorer'
  /** Navigation : réseau d'abord ; hors ligne, la coquille de l'application (index.html). */
  | 'navigation'
  /** Catalogue : réponse du cache tout de suite, mise à jour du cache en arrière-plan. */
  | 'revalidation'
  /** Ressource immuable (nom de fichier unique) : cache d'abord. */
  | 'cache-d-abord';

export interface RequeteDecrite {
  url: string;
  methode: string;
  /** `navigate` pour le chargement d'une page. */
  mode: string;
  /** Vrai si la requête porte un en-tête Range (lecture audio par morceaux). */
  plage: boolean;
}

/**
 * Choisit comment traiter une requête. L'audio (`musique/`) n'est jamais mis en cache : les requêtes
 * par plages sont mal gérées par l'API Cache et les MP3 sont lourds.
 */
export function choisirStrategie(
  requete: RequeteDecrite,
  base: string,
  origine: string,
): Strategie {
  if (requete.methode !== 'GET' || requete.plage) return 'ignorer';
  let url: URL;
  try {
    url = new URL(requete.url);
  } catch {
    return 'ignorer';
  }
  if (url.origin !== origine || !url.pathname.startsWith(base)) return 'ignorer';
  const chemin = url.pathname.slice(base.length);
  if (chemin === 'sw.js' || chemin.startsWith('musique/')) return 'ignorer';
  if (requete.mode === 'navigate') return 'navigation';
  if (chemin === 'catalogue.json') return 'revalidation';
  if (
    chemin.startsWith('assets/') ||
    chemin.startsWith('pochettes/') ||
    chemin.startsWith('icones/') ||
    chemin === 'manifest.webmanifest' ||
    chemin === 'favicon.ico'
  ) {
    return 'cache-d-abord';
  }
  return 'ignorer';
}

/** Horodatage de création lu dans le nom d'un cache (`ap3x-<horodatage>-<empreinte>`), ou 0. */
function horodatage(nom: string): number {
  const valeur = Number(nom.slice(PREFIXE_CACHE.length).split('-')[0]);
  return Number.isFinite(valeur) ? valeur : 0;
}

/**
 * Caches à supprimer à l'activation : tous les caches de l'application sauf le courant et le plus
 * récent des précédents. Garder le précédent permet à une page encore ouverte, chargée avant la mise à
 * jour, de retrouver ses fichiers (chunks chargés à la demande) dont le nom a changé.
 */
export function cachesASupprimer(existants: readonly string[], courant: string): string[] {
  const anciens = existants
    .filter((nom) => nom.startsWith(PREFIXE_CACHE) && nom !== courant)
    .sort((a, b) => horodatage(b) - horodatage(a));
  return anciens.slice(1);
}

/** Fichiers à précharger à l'installation : la coquille de l'application, avec la racine du site. */
export function listePrechargement(fichiersDist: readonly string[], base: string): string[] {
  const COQUILLE =
    /^(index\.html|catalogue\.json|favicon\.ico|manifest\.webmanifest|assets\/.+|icones\/.+)$/;
  const retenus = fichiersDist.filter((f) => COQUILLE.test(f)).map((f) => `${base}${f}`);
  return [base, ...retenus].sort();
}
