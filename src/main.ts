// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from './i18n';

const racine = document.getElementById('app');
if (racine === null) {
  throw new Error('Élément #app introuvable');
}

function afficher(conteneur: HTMLElement): void {
  conteneur.replaceChildren();
  const titre = document.createElement('h1');
  titre.textContent = t('site.nom');
  const pied = document.createElement('footer');
  pied.textContent = `${t('site.copyright')} – ${t('licence.musique')} – ${t('licence.site')}`;
  conteneur.append(titre, pied);
}

afficher(racine);
window.addEventListener('changement-langue', () => afficher(racine));
