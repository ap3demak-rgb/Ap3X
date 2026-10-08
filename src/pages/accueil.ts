// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from '../i18n';

export function pageAccueil(): HTMLElement {
  const section = document.createElement('section');
  const titre = document.createElement('h1');
  titre.textContent = t('site.nom');
  const intro = document.createElement('p');
  intro.textContent = t('accueil.intro');
  section.append(titre, intro);
  return section;
}
