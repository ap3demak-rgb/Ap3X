// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import './styles/theme.css';
import './styles/mise-en-page.css';
import { t } from './i18n';
import { pageAccueil } from './pages/accueil';
import { pageLicences } from './pages/licences';
import { ecouterRoute, routeCourante } from './routeur';
import { entete, evitement, pied } from './ui/gabarit';

const racine = document.getElementById('app');
if (racine === null) {
  throw new Error('Élément #app introuvable');
}

function afficher(conteneur: HTMLElement): void {
  const principal = document.createElement('main');
  principal.tabIndex = -1;
  principal.append(routeCourante() === 'licences' ? pageLicences() : pageAccueil());

  document.title = t('site.nom');
  conteneur.replaceChildren(evitement(principal), entete(), principal, pied());
}

afficher(racine);
window.addEventListener('changement-langue', () => afficher(racine));
ecouterRoute(() => afficher(racine));
