// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { estCleTri, type CleTri } from '../catalogue/navigation';
import { t, type CleI18n } from '../i18n';

const LIBELLES: Record<CleTri, CleI18n> = {
  recent: 'tri.recent',
  ancien: 'tri.ancien',
  titre: 'tri.titre',
  duree: 'tri.duree',
  artiste: 'tri.artiste',
};

/** Liste déroulante de choix du tri, avec son libellé. */
export function selecteurTri(
  options: readonly CleTri[],
  valeur: CleTri,
  surChangement: (tri: CleTri) => void,
): HTMLElement {
  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const texte = document.createElement('span');
  texte.textContent = t('tri.libelle');
  const liste = document.createElement('select');
  for (const cle of options) {
    const option = document.createElement('option');
    option.value = cle;
    option.textContent = t(LIBELLES[cle]);
    option.selected = cle === valeur;
    liste.append(option);
  }
  liste.addEventListener('change', () => {
    if (estCleTri(liste.value)) surChangement(liste.value);
  });
  etiquette.append(texte, liste);
  return etiquette;
}
