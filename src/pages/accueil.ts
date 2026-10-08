// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { plusRecents } from '../catalogue/donnees';
import { t } from '../i18n';
import { comptePistes } from '../i18n/format';
import { carteAlbum, cartePiste, grille } from '../ui/cartes';
import { definirTitrePage, remplirAvecCatalogue, sousTitre, titrePage } from './commun';

const NOMBRE_PISTES = 8;
const NOMBRE_ALBUMS = 6;

export function pageAccueil(): HTMLElement {
  definirTitrePage(t('site.nom'));
  const page = document.createElement('section');
  const intro = document.createElement('p');
  intro.textContent = t('accueil.intro');
  page.append(titrePage(t('site.nom')), intro);

  remplirAvecCatalogue(page, (donnees) => {
    const { pistes, albums, categories } = donnees.catalogue;
    const recentes = plusRecents(pistes, NOMBRE_PISTES);
    const blocs: HTMLElement[] = [];

    const sectionPistes = document.createElement('section');
    sectionPistes.append(
      sousTitre(t('accueil.dernieres_pistes')),
      recentes.length === 0
        ? Object.assign(document.createElement('p'), { textContent: t('accueil.vide') })
        : grille(recentes.map((piste) => cartePiste(donnees, piste, recentes))),
    );
    blocs.push(sectionPistes);

    if (albums.length > 0) {
      const sectionAlbums = document.createElement('section');
      sectionAlbums.append(
        sousTitre(t('accueil.derniers_albums')),
        grille(plusRecents(albums, NOMBRE_ALBUMS).map((album) => carteAlbum(donnees, album))),
      );
      blocs.push(sectionAlbums);
    }

    if (categories.length > 0) {
      const sectionCategories = document.createElement('section');
      const liste = document.createElement('ul');
      liste.className = 'liste-categories';
      for (const categorie of categories) {
        const element = document.createElement('li');
        const nom = document.createElement('strong');
        nom.textContent = categorie.nom;
        const compte = document.createElement('span');
        compte.textContent = comptePistes(categorie.nombrePistes);
        element.append(nom, compte);
        liste.append(element);
      }
      sectionCategories.append(sousTitre(t('accueil.categories')), liste);
      blocs.push(sectionCategories);
    }
    return blocs;
  });
  return page;
}
