// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { URL_DEPOT } from '../constantes';
import { t } from '../i18n';

function bloc(titre: string, detail: string, mention: string): HTMLElement {
  const section = document.createElement('section');
  const sousTitre = document.createElement('h2');
  sousTitre.textContent = titre;
  const texte = document.createElement('p');
  texte.textContent = detail;
  const licence = document.createElement('p');
  licence.textContent = mention;
  section.append(sousTitre, texte, licence);
  return section;
}

export function pageLicences(): HTMLElement {
  const section = document.createElement('section');
  const titre = document.createElement('h1');
  titre.textContent = t('nav.licences');
  const depot = document.createElement('p');
  const lien = document.createElement('a');
  lien.href = URL_DEPOT;
  lien.rel = 'noopener';
  lien.textContent = t('licences.depot');
  depot.append(lien);
  section.append(
    titre,
    bloc(t('licences.musique.titre'), t('licences.musique.detail'), t('licence.musique')),
    bloc(t('licences.code.titre'), t('licences.code.detail'), t('licence.site')),
    depot,
  );
  return section;
}
