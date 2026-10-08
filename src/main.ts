// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import './styles/theme.css';
import './styles/mise-en-page.css';
import './styles/lecteur.css';
import './styles/cartes.css';
import { t } from './i18n';
import { demarrerLecteur, reconstruireBarre } from './lecteur';
import { pageAccueil } from './pages/accueil';
import { pageAlbum } from './pages/album';
import { pageAlbums } from './pages/albums';
import { pageLicences } from './pages/licences';
import { pagePiste } from './pages/piste';
import { ecouterRoute, routeCourante, type Route } from './routeur';
import { entete, evitement, pied } from './ui/gabarit';

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

  document.title = t('site.nom');
  conteneur.replaceChildren(evitement(principal), entete(), principal, pied());
  if (navigation) {
    window.scrollTo(0, 0);
    principal.focus({ preventScroll: true });
  }
}

afficher(racine, false);
demarrerLecteur();
window.addEventListener('changement-langue', () => {
  afficher(racine, false);
  reconstruireBarre();
});
ecouterRoute(() => afficher(racine, true));
