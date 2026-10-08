// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { urlDuFichier } from '../catalogue/charger';
import { pistesDeAlbum, pistesSimilaires, type Donnees } from '../catalogue/donnees';
import type { Piste } from '../catalogue/schemas';
import { t } from '../i18n';
import { formaterDate, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { lienAlbum } from '../routeur';
import { cartePiste, grille, lien, pochette } from '../ui/cartes';
import { creerOnde } from '../ui/onde';
import { introuvable, remplirAvecCatalogue, sousTitre, titrePage } from './commun';

function detail(donnees: Donnees, piste: Piste): HTMLElement[] {
  const album = piste.album !== undefined ? donnees.albums.get(piste.album) : undefined;
  const file = album !== undefined ? pistesDeAlbum(donnees, album) : [piste];
  const categorie = donnees.categories.get(piste.categorie)?.nom ?? piste.categorie;

  const entete = document.createElement('div');
  entete.className = 'fiche';
  const infos = document.createElement('div');
  infos.className = 'fiche-infos';
  const artiste = document.createElement('p');
  artiste.className = 'fiche-artiste';
  artiste.textContent = piste.artiste;

  const lire = document.createElement('button');
  lire.type = 'button';
  lire.className = 'bouton bouton-principal';
  lire.textContent = t('lecteur.lecture');
  lire.setAttribute('aria-label', `${t('lecteur.lecture')} : ${piste.titre} – ${piste.artiste}`);
  lire.addEventListener('click', () => {
    const courante = lecteur.etat().piste;
    if (courante?.id === piste.id) lecteur.basculer();
    else lecteur.charger(file, file.indexOf(piste));
  });

  const meta = document.createElement('dl');
  meta.className = 'meta';
  const ajouter = (terme: string, valeur: string | HTMLElement): void => {
    const dt = document.createElement('dt');
    dt.textContent = terme;
    const dd = document.createElement('dd');
    dd.append(valeur);
    meta.append(dt, dd);
  };
  ajouter(t('piste.categorie'), categorie);
  if (album !== undefined) ajouter(t('piste.album'), lien(lienAlbum(album.id), album.titre));
  if (piste.date !== undefined) ajouter(t('piste.date'), formaterDate(piste.date));
  ajouter(t('album.duree_totale'), formaterDuree(piste.duree));
  ajouter(t('piste.licence'), piste.licence);
  ajouter(t('piste.copyright'), piste.copyright);

  infos.append(titrePage(piste.titre), artiste);
  if (piste.description !== '') {
    const description = document.createElement('p');
    description.textContent = piste.description;
    infos.append(description);
  }
  if (piste.hashtags.length > 0) {
    const hashtags = document.createElement('p');
    hashtags.className = 'hashtags';
    hashtags.setAttribute('aria-label', t('piste.hashtags'));
    hashtags.textContent = piste.hashtags.map((h) => `#${h}`).join(' ');
    infos.append(hashtags);
  }
  infos.append(meta, lire);
  if (piste.telechargement) {
    const telecharger = lien(urlDuFichier(piste.fichier), t('piste.telecharger'), 'bouton');
    telecharger.setAttribute('download', '');
    infos.append(telecharger);
  }
  entete.append(pochette(piste.pochette, 'pochette-grande'), infos);

  const onde = creerOnde({
    piste,
    grande: true,
    surPosition: (secondes) => {
      if (lecteur.etat().piste?.id !== piste.id) lecteur.charger(file, file.indexOf(piste));
      lecteur.aller(secondes);
    },
  });

  const blocs: HTMLElement[] = [entete, onde];
  const similaires = pistesSimilaires(donnees, piste, 6);
  if (similaires.length > 0) {
    const section = document.createElement('section');
    section.append(
      sousTitre(t('piste.similaires')),
      grille(similaires.map((autre) => cartePiste(donnees, autre, similaires))),
    );
    blocs.push(section);
  }
  return blocs;
}

export function pagePiste(id: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    const piste = donnees.pistes.get(id);
    return piste === undefined ? [introuvable(t('piste.introuvable'))] : detail(donnees, piste);
  });
  return page;
}
