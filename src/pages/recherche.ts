// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { rechercher } from '../catalogue/recherche';
import { t, tv } from '../i18n';
import { comptePistes } from '../i18n/format';
import { lienArtiste, lienCategorie, lienTag } from '../routeur';
import { carteAlbum, cartePiste, grille, lien } from '../ui/cartes';
import { definirTitrePage, remplirAvecCatalogue, sousTitre, titrePage } from './commun';

function listeDeLiens(elements: { href: string; texte: string; detail?: string }[]): HTMLElement {
  const liste = document.createElement('ul');
  liste.className = 'liste-liens';
  for (const { href, texte, detail } of elements) {
    const element = document.createElement('li');
    element.append(lien(href, texte));
    if (detail !== undefined) {
      const precision = document.createElement('span');
      precision.className = 'carte-meta';
      precision.textContent = detail;
      element.append(precision);
    }
    liste.append(element);
  }
  return liste;
}

/** Page des résultats complets d'une recherche. */
export function pageRecherche(requete: string): HTMLElement {
  const titre = tv('recherche.titre', { q: requete });
  definirTitrePage(titre);
  const page = document.createElement('section');
  page.append(titrePage(titre));

  remplirAvecCatalogue(page, (donnees) => {
    const resultats = rechercher(donnees, requete);
    const compte = document.createElement('p');
    compte.className = 'carte-meta';
    compte.textContent = tv('recherche.compte', { n: resultats.total });
    if (resultats.total === 0) {
      const vide = document.createElement('p');
      vide.textContent = tv('recherche.aucun', { q: requete });
      return [compte, vide];
    }
    const blocs: HTMLElement[] = [compte];
    const ajouter = (titreSection: string, contenu: HTMLElement): void => {
      const section = document.createElement('section');
      section.append(sousTitre(titreSection), contenu);
      blocs.push(section);
    };
    if (resultats.albums.length > 0) {
      ajouter(t('nav.albums'), grille(resultats.albums.map((a) => carteAlbum(donnees, a))));
    }
    if (resultats.pistes.length > 0) {
      ajouter(
        t('categorie.titres'),
        grille(resultats.pistes.map((p) => cartePiste(donnees, p, resultats.pistes))),
      );
    }
    if (resultats.artistes.length > 0) {
      ajouter(
        t('recherche.artistes'),
        listeDeLiens(
          resultats.artistes.map((a) => ({
            href: lienArtiste(a.nom),
            texte: a.nom,
            detail: comptePistes(a.nombre),
          })),
        ),
      );
    }
    if (resultats.hashtags.length > 0) {
      ajouter(
        t('piste.hashtags'),
        listeDeLiens(
          resultats.hashtags.map((h) => ({
            href: lienTag(h.nom),
            texte: `#${h.nom}`,
            detail: comptePistes(h.nombre),
          })),
        ),
      );
    }
    if (resultats.categories.length > 0) {
      ajouter(
        t('nav.categories'),
        listeDeLiens(
          resultats.categories.map((c) => ({
            href: lienCategorie(c.slug),
            texte: c.nom,
            detail: comptePistes(c.nombrePistes),
          })),
        ),
      );
    }
    return blocs;
  });
  return page;
}
