// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { urlDuFichier } from '../catalogue/charger';
import { pistesDeAlbum, pistesSimilaires, type Donnees } from '../catalogue/donnees';
import type { Piste } from '../catalogue/schemas';
import { t } from '../i18n';
import { formaterDate, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { lienAlbum } from '../routeur';
import {
  boutonFile,
  boutonJaime,
  boutonPlaylist,
  cartePiste,
  chipsHashtags,
  grille,
  lien,
  lienDeLArtiste,
  pochette3d,
} from '../ui/cartes';
import { annoncer } from '../ui/annonceur';
import { creerOnde } from '../ui/onde';
import { blocPartage } from '../ui/partage';
import {
  definirTitrePage,
  introuvable,
  remplirAvecCatalogue,
  sousTitre,
  titrePage,
} from './commun';

/** Ouverture de la page : `demarrer` lance la lecture (lien partagé), à `instant` secondes si fourni. */
export interface OptionsPagePiste {
  demarrer: boolean;
  instant?: number | undefined;
}

function detail(donnees: Donnees, piste: Piste, options: OptionsPagePiste): HTMLElement[] {
  const album = piste.album !== undefined ? donnees.albums.get(piste.album) : undefined;
  const file = album !== undefined ? pistesDeAlbum(donnees, album) : [piste];
  const categorie = donnees.categories.get(piste.categorie)?.nom ?? piste.categorie;

  const entete = document.createElement('div');
  entete.className = 'fiche';
  const infos = document.createElement('div');
  infos.className = 'fiche-infos';
  const artiste = document.createElement('p');
  artiste.className = 'fiche-artiste';
  artiste.append(lienDeLArtiste(piste.artiste));

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
  const hashtags = chipsHashtags(piste.hashtags);
  if (hashtags !== undefined) infos.append(hashtags);
  const actions = document.createElement('div');
  actions.className = 'carte-actions';
  actions.append(
    lire,
    boutonFile(piste.titre, () => [piste]),
    boutonJaime(piste),
    boutonPlaylist(piste.titre, () => [piste.id]),
  );
  infos.append(
    meta,
    actions,
    blocPartage({ type: 'piste', id: piste.id, titre: piste.titre, avecInstant: true }),
  );
  if (piste.telechargement) {
    const telecharger = lien(urlDuFichier(piste.fichier), t('piste.telecharger'), 'bouton');
    telecharger.setAttribute('download', '');
    actions.append(telecharger);
  }
  entete.append(pochette3d(piste.pochette), infos);

  const onde = creerOnde({
    piste,
    grande: true,
    surPosition: (secondes) => {
      if (lecteur.etat().piste?.id !== piste.id) lecteur.charger(file, file.indexOf(piste));
      lecteur.aller(secondes);
    },
  });

  if (options.demarrer) demarrerDepuisLien(infos, file, piste, options.instant);

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

/**
 * Ouverture d'un lien partagé : lance la lecture de la piste (à l'instant demandé). Si le navigateur
 * refuse la lecture automatique, la piste reste chargée à la bonne position et un message invite à
 * appuyer sur Lecture.
 */
function demarrerDepuisLien(
  zone: HTMLElement,
  file: readonly Piste[],
  piste: Piste,
  instant: number | undefined,
): void {
  const message = document.createElement('p');
  message.className = 'carte-meta';
  message.setAttribute('role', 'status');
  zone.append(message);
  lecteur.addEventListener(
    'bloquee',
    () => {
      message.textContent = t('partage.lecture_bloquee');
      annoncer(t('partage.lecture_bloquee'));
    },
    { once: true },
  );
  lecteur.charger(file, file.indexOf(piste), true);
  if (instant !== undefined) lecteur.aller(instant);
}

export function pagePiste(
  id: string,
  options: OptionsPagePiste = { demarrer: false },
): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    const piste = donnees.pistes.get(id);
    definirTitrePage(piste === undefined ? t('piste.introuvable') : piste.titre);
    return piste === undefined
      ? [introuvable(t('piste.introuvable'))]
      : detail(donnees, piste, options);
  });
  return page;
}
