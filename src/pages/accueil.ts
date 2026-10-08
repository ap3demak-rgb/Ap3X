// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { plusRecents } from '../catalogue/donnees';
import { hashtagsPopulaires, niveauNuage } from '../catalogue/navigation';
import { t } from '../i18n';
import { comptePistes } from '../i18n/format';
import { lienCategorie, lienTag } from '../routeur';
import { carteAlbum, cartePiste, grille, lien } from '../ui/cartes';
import { definirTitrePage, remplirAvecCatalogue, sousTitre, titrePage } from './commun';

const NOMBRE_PISTES = 8;
const NOMBRE_ALBUMS = 6;
const NOMBRE_HASHTAGS = 24;

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
        nom.append(lien(lienCategorie(categorie.slug), categorie.nom));
        const compte = document.createElement('span');
        compte.textContent = comptePistes(categorie.nombrePistes);
        element.append(nom, compte);
        liste.append(element);
      }
      sectionCategories.append(sousTitre(t('accueil.categories')), liste);
      blocs.push(sectionCategories);
    }

    const populaires = hashtagsPopulaires(donnees.catalogue, NOMBRE_HASHTAGS);
    if (populaires.length > 0) {
      const nombres = populaires.map((h) => h.nombre);
      const minimum = Math.min(...nombres);
      const maximum = Math.max(...nombres);
      const nuage = document.createElement('ul');
      nuage.className = 'nuage';
      // Ordre alphabétique : plus facile à parcourir qu'un classement par popularité.
      for (const hashtag of [...populaires].sort((a, b) => a.nom.localeCompare(b.nom))) {
        const element = document.createElement('li');
        const niveau = niveauNuage(hashtag.nombre, minimum, maximum);
        const a = lien(lienTag(hashtag.nom), `#${hashtag.nom}`, `nuage-${niveau}`);
        a.setAttribute('aria-label', `#${hashtag.nom} – ${comptePistes(hashtag.nombre)}`);
        element.append(a);
        nuage.append(element);
      }
      const section = document.createElement('section');
      section.append(sousTitre(t('accueil.hashtags')), nuage);
      blocs.push(section);
    }
    return blocs;
  });
  return page;
}
