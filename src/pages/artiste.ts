// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { oeuvresDeLArtiste } from '../catalogue/recherche';
import { t } from '../i18n';
import { collection } from './collection';
import { definirTitrePage, introuvable, remplirAvecCatalogue } from './commun';

/** Page d'un artiste : ses albums et toutes ses pistes. */
export function pageArtiste(nom: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    const { albums, pistes } = oeuvresDeLArtiste(donnees, nom);
    if (albums.length === 0 && pistes.length === 0) {
      definirTitrePage(t('artiste.introuvable'));
      return [introuvable(t('artiste.introuvable'))];
    }
    definirTitrePage(nom);
    return collection({
      donnees,
      titre: nom,
      albums,
      pistes,
      // Toutes les pistes de l'artiste, qu'elles appartiennent ou non à un de ses albums.
      file: (_albums, pistesTriees) => [...pistesTriees],
      messageVide: t('categorie.vide'),
    });
  });
  return page;
}
