// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/**
 * Enregistre le service worker (coquille de l'application disponible hors ligne). Uniquement en
 * production : en développement, un service worker masquerait les modifications.
 * Une mise à jour s'active toute seule et s'applique au prochain chargement de la page.
 */
export function enregistrerServiceWorker(): void {
  if (!import.meta.env.PROD || !('serviceWorker' in navigator)) return;
  const enregistrer = (): void => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`, { scope: import.meta.env.BASE_URL })
      .catch((erreur: unknown) => console.warn('Service worker non enregistré :', erreur));
  };
  // Après le chargement : l'enregistrement (et le préchargement) ne retarde pas l'affichage.
  if (document.readyState === 'complete') enregistrer();
  else window.addEventListener('load', enregistrer, { once: true });
}
