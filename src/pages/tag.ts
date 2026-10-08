// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { albumsDuHashtag, pistesDuHashtag } from '../catalogue/navigation';
import { t } from '../i18n';
import { collection } from './collection';
import { definirTitrePage, remplirAvecCatalogue } from './commun';

/** Page d'un hashtag : les albums et toutes les pistes qui le portent. */
export function pageTag(nom: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    const titre = `#${nom}`;
    definirTitrePage(titre);
    return collection({
      donnees,
      titre,
      albums: albumsDuHashtag(donnees, nom),
      pistes: pistesDuHashtag(donnees, nom),
      // Toutes les pistes du hashtag, qu'elles appartiennent ou non à un album.
      file: (_albums, pistes) => [...pistes],
      messageVide: t('tag.vide'),
    });
  });
  return page;
}
