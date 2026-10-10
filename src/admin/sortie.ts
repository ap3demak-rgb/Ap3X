// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

export interface SurveillanceModifications {
  /** Signale une modification : le navigateur avertira avant de fermer ou recharger la page. */
  marquer(): void;
  /** Plus rien à perdre (enregistré ou abandonné). */
  oublier(): void;
}

/**
 * Avertit avant de quitter la page tant que le formulaire contient des modifications. L'avertissement
 * disparaît tout seul quand le formulaire est retiré de la page (navigation interne).
 */
export function surveillerModifications(formulaire: HTMLElement): SurveillanceModifications {
  let modifie = false;
  const avantFermeture = (evenement: BeforeUnloadEvent): void => {
    evenement.preventDefault();
  };
  const oublier = (): void => {
    modifie = false;
    window.removeEventListener('beforeunload', avantFermeture);
  };
  const marquer = (): void => {
    if (modifie) return;
    modifie = true;
    window.addEventListener('beforeunload', avantFermeture);
  };
  formulaire.addEventListener('input', marquer);
  formulaire.addEventListener('change', marquer);

  const observateur = new MutationObserver(() => {
    if (!formulaire.isConnected) {
      oublier();
      observateur.disconnect();
    }
  });
  // Observation lancée une fois le formulaire inséré dans la page.
  queueMicrotask(() => observateur.observe(document.body, { childList: true, subtree: true }));
  return { marquer, oublier };
}
