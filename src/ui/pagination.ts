// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { TAILLE_PAGE, prochainsAffiches } from '../pagination';
import { annoncer } from './annonceur';

/**
 * Grille de cartes affichée par pages : les cartes ne sont créées qu'au fur et à mesure, ce qui garde
 * le site rapide même avec des milliers de pistes. Un bouton « Voir plus » ajoute la page suivante,
 * déplace le focus sur la première nouvelle carte et annonce « n affichés sur total ».
 */
export function grillePaginee(
  total: number,
  creerCarte: (index: number) => HTMLElement,
  taille = TAILLE_PAGE,
): HTMLElement {
  const racine = document.createElement('div');
  racine.className = 'liste-paginee';
  const grille = document.createElement('div');
  grille.className = 'grille';
  racine.append(grille);

  let affiches = 0;
  const pied = document.createElement('div');
  pied.className = 'pagination';
  const etat = document.createElement('p');
  etat.className = 'carte-meta';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.textContent = t('liste.voir_plus');
  pied.append(etat, bouton);

  const ajouter = (jusqua: number): HTMLElement | undefined => {
    const premiere = affiches;
    const nouvelles: HTMLElement[] = [];
    for (let i = premiere; i < jusqua; i += 1) nouvelles.push(creerCarte(i));
    grille.append(...nouvelles);
    affiches = jusqua;
    etat.textContent = tv('liste.affichage', { n: affiches, total });
    bouton.hidden = affiches >= total;
    return nouvelles[0];
  };

  ajouter(Math.min(total, taille));
  if (total > taille) racine.append(pied);

  bouton.addEventListener('click', () => {
    const premiere = ajouter(prochainsAffiches(affiches, total, taille));
    // Le bouton disparaît à la dernière page : le focus passe donc à la première nouvelle carte.
    // Premier élément accessible de la carte : le lien de pochette est masqué aux lecteurs d'écran.
    premiere?.querySelector<HTMLElement>('a:not([aria-hidden="true"]), button')?.focus();
    annoncer(etat.textContent);
  });
  return racine;
}

/** Variante de `grillePaginee` pour une liste d'éléments : `creer` reçoit l'élément et sa position. */
export function grillePagineeDe<T>(
  elements: readonly T[],
  creer: (element: T, index: number) => HTMLElement,
  taille = TAILLE_PAGE,
): HTMLElement {
  return grillePaginee(
    elements.length,
    (index) => {
      const element = elements[index];
      if (element === undefined) throw new Error(`Élément ${index} absent de la liste`);
      return creer(element, index);
    },
    taille,
  );
}
