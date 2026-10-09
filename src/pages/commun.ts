// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { chargerCatalogue } from '../catalogue/charger';
import { donneesDe, type Donnees } from '../catalogue/donnees';
import { t } from '../i18n';
import { annoncer } from '../ui/annonceur';

/**
 * Charge le catalogue puis ajoute à `page` les éléments produits par `rendu`.
 * En cas d'échec, affiche une alerte. `rendu` est rappelé avec des données indexées et partagées.
 */
export function remplirAvecCatalogue(
  page: HTMLElement,
  rendu: (donnees: Donnees) => HTMLElement[],
): void {
  chargerCatalogue()
    .then((catalogue) => {
      page.append(...rendu(donneesDe(catalogue)));
    })
    .catch((erreur: unknown) => {
      console.error(erreur);
      const zone = document.createElement('div');
      zone.className = 'erreur-chargement';
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = t('erreur.chargement');
      const reessayer = document.createElement('button');
      reessayer.type = 'button';
      reessayer.className = 'bouton';
      reessayer.textContent = t('erreur.reessayer');
      reessayer.addEventListener('click', () => {
        zone.remove();
        remplirAvecCatalogue(page, rendu);
      });
      zone.append(message, reessayer);
      page.append(zone);
    });
}

/** Définit le titre de l'onglet et l'annonce aux lecteurs d'écran. */
export function definirTitrePage(titre: string): void {
  document.title = titre === t('site.nom') ? titre : `${titre} – ${t('site.nom')}`;
  annoncer(document.title);
}

export function titrePage(texte: string): HTMLElement {
  const titre = document.createElement('h1');
  titre.textContent = texte;
  return titre;
}

export function sousTitre(texte: string): HTMLElement {
  const titre = document.createElement('h2');
  titre.textContent = texte;
  return titre;
}

/** Message « introuvable » avec retour à l'accueil. */
export function introuvable(message: string): HTMLElement {
  const bloc = document.createElement('div');
  const texte = document.createElement('p');
  texte.setAttribute('role', 'alert');
  texte.textContent = message;
  const retour = document.createElement('a');
  retour.href = '#/';
  retour.textContent = t('page.retour_accueil');
  bloc.append(texte, retour);
  return bloc;
}
