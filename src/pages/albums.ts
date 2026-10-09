// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { anneeDe, filtrerAlbums, type Donnees, type FiltresAlbums } from '../catalogue/donnees';
import { trierAlbums } from '../catalogue/navigation';
import { TYPES_ALBUM } from '../catalogue/types-album';
import { obtenirLangue, t, type CleI18n } from '../i18n';
import { carteAlbum } from '../ui/cartes';
import { grillePagineeDe } from '../ui/pagination';
import { selecteurTri } from '../ui/tri';
import { etatTri } from './collection';
import { definirTitrePage, remplirAvecCatalogue, titrePage } from './commun';

/** Filtres conservés entre deux affichages de la page (changement de langue, navigation). */
const filtres: FiltresAlbums = { type: '', categorie: '', annee: '' };

function selecteur(
  libelle: string,
  valeur: string,
  options: { valeur: string; texte: string }[],
  surChangement: (valeur: string) => void,
): HTMLElement {
  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const texte = document.createElement('span');
  texte.textContent = libelle;
  const liste = document.createElement('select');
  for (const option of options) {
    const element = document.createElement('option');
    element.value = option.valeur;
    element.textContent = option.texte;
    element.selected = option.valeur === valeur;
    liste.append(element);
  }
  liste.addEventListener('change', () => surChangement(liste.value));
  etiquette.append(texte, liste);
  return etiquette;
}

function contenuGrille(donnees: Donnees): HTMLElement {
  const albums = trierAlbums(
    filtrerAlbums(donnees.catalogue.albums, filtres),
    etatTri.valeur,
    obtenirLangue(),
  );
  if (albums.length === 0) {
    const vide = document.createElement('p');
    vide.textContent = t('albums.vide');
    return vide;
  }
  return grillePagineeDe(albums, (album) => carteAlbum(donnees, album, 'h2'));
}

export function pageAlbums(): HTMLElement {
  definirTitrePage(t('nav.albums'));
  const page = document.createElement('section');
  page.append(titrePage(t('nav.albums')));

  remplirAvecCatalogue(page, (donnees) => {
    const { albums, categories } = donnees.catalogue;
    const tous = { valeur: '', texte: t('albums.tous') };
    const types = TYPES_ALBUM.filter((type) => albums.some((a) => a.type === type));
    const annees = [
      ...new Set(albums.map((a) => anneeDe(a.date)).filter((a): a is string => a !== undefined)),
    ].sort((a, b) => b.localeCompare(a));
    const categoriesAvecAlbums = categories.filter((c) =>
      albums.some((a) => a.categorie === c.slug),
    );

    const zone = document.createElement('div');
    zone.setAttribute('aria-live', 'polite');
    const rafraichir = (): void => zone.replaceChildren(contenuGrille(donnees));

    const barre = document.createElement('div');
    barre.className = 'filtres';
    barre.append(
      selecteur(
        t('albums.filtre_type'),
        filtres.type,
        [tous, ...types.map((type) => ({ valeur: type, texte: t(`type.${type}` as CleI18n) }))],
        (v) => {
          filtres.type = v;
          rafraichir();
        },
      ),
      selecteur(
        t('albums.filtre_categorie'),
        filtres.categorie,
        [tous, ...categoriesAvecAlbums.map((c) => ({ valeur: c.slug, texte: c.nom }))],
        (v) => {
          filtres.categorie = v;
          rafraichir();
        },
      ),
      selecteur(
        t('albums.filtre_annee'),
        filtres.annee,
        [tous, ...annees.map((a) => ({ valeur: a, texte: a }))],
        (v) => {
          filtres.annee = v;
          rafraichir();
        },
      ),
      selecteurTri(['recent', 'ancien', 'titre', 'duree', 'artiste'], etatTri.valeur, (tri) => {
        etatTri.valeur = tri;
        rafraichir();
      }),
    );
    rafraichir();
    return [barre, zone];
  });
  return page;
}
