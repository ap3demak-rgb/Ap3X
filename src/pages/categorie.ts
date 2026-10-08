// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Donnees } from '../catalogue/donnees';
import {
  albumsDeCategorie,
  CATEGORIE_FAVORIS,
  CATEGORIE_TOUT,
  pistesDeCategorie,
  pistesHorsAlbum,
} from '../catalogue/navigation';
import type { Piste } from '../catalogue/schemas';
import { favoris } from '../favoris';
import { t } from '../i18n';
import { compteAlbums, comptePistes } from '../i18n/format';
import { lienCategorie } from '../routeur';
import { lien } from '../ui/cartes';
import { collection } from './collection';
import { definirTitrePage, introuvable, remplirAvecCatalogue, titrePage } from './commun';

/** Pistes aimées encore présentes dans le catalogue, dans l'ordre où elles ont été aimées. */
function pistesFavorites(donnees: Donnees): Piste[] {
  return favoris
    .liste()
    .map((id) => donnees.pistes.get(id))
    .filter((p): p is Piste => p !== undefined);
}

/** Page d'une catégorie, de « Tout » ou de « Favoris ». */
export function pageCategorie(slug: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    if (slug === CATEGORIE_FAVORIS) {
      definirTitrePage(t('categorie.favoris'));
      return collection({
        donnees,
        titre: t('categorie.favoris'),
        albums: [],
        pistes: pistesFavorites(donnees),
        file: (_albums, pistes) => [...pistes],
        messageVide: t('favoris.vide'),
        suivreFavoris: () => ({ albums: [], pistes: pistesFavorites(donnees) }),
      });
    }
    const categorie = slug === CATEGORIE_TOUT ? undefined : donnees.categories.get(slug);
    if (slug !== CATEGORIE_TOUT && categorie === undefined) {
      definirTitrePage(t('categorie.introuvable'));
      return [introuvable(t('categorie.introuvable'))];
    }
    const nom = categorie?.nom ?? t('categorie.tout');
    definirTitrePage(nom);
    return collection({
      donnees,
      titre: nom,
      ...(categorie?.description !== undefined && { description: categorie.description }),
      albums: albumsDeCategorie(donnees, slug),
      pistes: pistesHorsAlbum(pistesDeCategorie(donnees, slug)),
      messageVide: t('categorie.vide'),
    });
  });
  return page;
}

/** Page « Catégories » : toutes les catégories avec leur nombre de pistes et d'albums. */
export function pageCategories(): HTMLElement {
  definirTitrePage(t('nav.categories'));
  const page = document.createElement('section');
  page.append(titrePage(t('nav.categories')));
  remplirAvecCatalogue(page, (donnees) => {
    const liste = document.createElement('ul');
    liste.className = 'liste-categories liste-categories-grande';
    const ajouter = (
      slug: string,
      nom: string,
      description: string,
      pistes: number,
      albums: number | undefined,
      couleur?: string,
    ): void => {
      const element = document.createElement('li');
      if (couleur !== undefined) element.style.setProperty('--couleur-categorie', couleur);
      const titre = document.createElement('h2');
      titre.append(lien(lienCategorie(slug), nom));
      const compte = document.createElement('p');
      compte.className = 'carte-meta';
      compte.textContent =
        albums === undefined
          ? comptePistes(pistes)
          : `${comptePistes(pistes)} · ${compteAlbums(albums)}`;
      element.append(titre);
      if (description !== '') {
        const texte = document.createElement('p');
        texte.textContent = description;
        element.append(texte);
      }
      element.append(compte);
      liste.append(element);
    };
    ajouter(
      CATEGORIE_TOUT,
      t('categorie.tout'),
      '',
      donnees.catalogue.pistes.length,
      donnees.catalogue.albums.length,
    );
    for (const c of donnees.catalogue.categories) {
      ajouter(c.slug, c.nom, c.description, c.nombrePistes, c.nombreAlbums, c.couleur);
    }
    ajouter(
      CATEGORIE_FAVORIS,
      t('categorie.favoris'),
      '',
      pistesFavorites(donnees).length,
      undefined,
    );
    return [liste];
  });
  return page;
}
