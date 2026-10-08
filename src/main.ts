// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import './styles/theme.css';
import './styles/mise-en-page.css';
import './styles/lecteur.css';
import './styles/cartes.css';
import './styles/rendu3d.css';
import { obtenirLangue, t } from './i18n';
import { demarrerLecteur, reconstruireBarre } from './lecteur';
import { demarrerRendu3d } from './rendu3d';
import { pageAccueil } from './pages/accueil';
import { pageAlbum } from './pages/album';
import { pageAlbums } from './pages/albums';
import { pageLicences } from './pages/licences';
import { pagePiste } from './pages/piste';
import { ecouterRoute, routeCourante, type Route } from './routeur';
import { annonceur, annoncer } from './ui/annonceur';
import { bandeau } from './ui/bandeau';
import { entete, evitement, NOMS_LANGUES, pied } from './ui/gabarit';

const racine = document.getElementById('app');
if (racine === null) {
  throw new Error('Élément #app introuvable');
}

function page(route: Route): HTMLElement {
  switch (route.nom) {
    case 'licences':
      return pageLicences();
    case 'albums':
      return pageAlbums();
    case 'album':
      return pageAlbum(route.id);
    case 'piste':
      return pagePiste(route.id);
    case 'accueil':
      return pageAccueil();
  }
}

/** Affiche la page courante. `navigation` : déplace le focus sur le contenu et remonte en haut. */
function afficher(conteneur: HTMLElement, navigation: boolean): void {
  const principal = document.createElement('main');
  principal.tabIndex = -1;
  principal.append(page(routeCourante()));

  conteneur.replaceChildren(evitement(principal), entete(), bandeau.element, principal, pied());
  if (navigation) {
    window.scrollTo(0, 0);
    principal.focus({ preventScroll: true });
  }
}

document.body.append(annonceur.element);
afficher(racine, false);
demarrerLecteur();
// Le rendu 3D (Three.js) se charge après l'affichage de l'interface, sans la retarder.
if ('requestIdleCallback' in window) window.requestIdleCallback(demarrerRendu3d);
else setTimeout(demarrerRendu3d, 200);
window.addEventListener('changement-langue', () => {
  afficher(racine, false);
  reconstruireBarre();
  annoncer(`${t('langue.libelle')} : ${NOMS_LANGUES[obtenirLangue()]}`);
});
ecouterRoute(() => afficher(racine, true));
