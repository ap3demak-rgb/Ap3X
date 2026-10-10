// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { albumsLies, pistesDeAlbum, type Donnees } from '../catalogue/donnees';
import { reglages } from '../site/reglages';
import type { Album, Piste } from '../catalogue/schemas';
import { t, tv } from '../i18n';
import { comptePistes, formaterDate, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { lienPiste } from '../routeur';
import {
  boutonFile,
  boutonJaime,
  boutonJaimeAlbum,
  boutonPlaylist,
  carteAlbum,
  chipsHashtags,
  grille,
  lien,
  lienDeLArtiste,
  pochette,
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

function definition(terme: string, valeur: string): HTMLElement[] {
  const dt = document.createElement('dt');
  dt.textContent = terme;
  const dd = document.createElement('dd');
  dd.textContent = valeur;
  return [dt, dd];
}

function listeDePistes(pistes: Piste[], toutes: Piste[]): HTMLElement {
  const liste = document.createElement('ol');
  liste.className = 'liste-titres';
  for (const piste of pistes) {
    const ligne = document.createElement('li');
    if (piste.numero !== undefined) ligne.value = piste.numero;
    const description = `${piste.titre} – ${piste.artiste}`;
    const lire = document.createElement('button');
    lire.type = 'button';
    lire.className = 'bouton';
    lire.textContent = t('lecteur.lecture');
    lire.setAttribute('aria-label', `${t('lecteur.lecture')} : ${description}`);
    lire.addEventListener('click', () => lecteur.charger(toutes, toutes.indexOf(piste)));
    const nom = document.createElement('span');
    nom.className = 'titre-nom';
    nom.append(lien(lienPiste(piste.id), piste.titre));
    const duree = document.createElement('span');
    duree.className = 'titre-duree';
    duree.textContent = formaterDuree(piste.duree);
    const onde = creerOnde({
      piste,
      surPosition: (secondes) => {
        if (lecteur.etat().piste?.id !== piste.id) lecteur.charger(toutes, toutes.indexOf(piste));
        lecteur.aller(secondes);
      },
    });
    ligne.append(lire, nom, duree, boutonJaime(piste), onde);
    liste.append(ligne);
  }
  return liste;
}

/** Téléchargement de l'album en ZIP, construit dans le navigateur (bibliothèque chargée à la demande). */
function blocTelechargement(donnees: Donnees, album: Album): HTMLElement {
  const bloc = document.createElement('div');
  bloc.className = 'partage';
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.textContent = t('album.telecharger_zip');
  bouton.setAttribute('aria-label', `${t('album.telecharger_zip')} : ${album.titre}`);
  // Progression visible mais non annoncée à chaque piste : le début et la fin le sont.
  const progression = document.createElement('span');
  progression.className = 'carte-meta';
  const erreur = document.createElement('p');
  erreur.className = 'erreur-champ';
  erreur.setAttribute('role', 'alert');
  bouton.addEventListener('click', () => {
    bouton.disabled = true;
    erreur.textContent = '';
    const total = album.nombrePistes;
    progression.textContent = tv('album.zip_progression', { n: 0, total });
    annoncer(progression.textContent);
    void import('../telechargement-zip')
      .then(async ({ archiveAlbum, enregistrerFichier }) => {
        const { blob, nom } = await archiveAlbum(donnees, album, (n, sur) => {
          progression.textContent = tv('album.zip_progression', { n, total: sur });
        });
        enregistrerFichier(blob, nom);
        progression.textContent = t('album.zip_pret');
        annoncer(t('album.zip_pret'));
      })
      .catch((cause: unknown) => {
        console.error(cause);
        progression.textContent = '';
        erreur.textContent = t('album.zip_erreur');
      })
      .finally(() => {
        bouton.disabled = false;
      });
  });
  bloc.append(bouton, progression, erreur);
  return bloc;
}

function detail(donnees: Donnees, album: Album): HTMLElement[] {
  const pistes = pistesDeAlbum(donnees, album);
  const categorie = donnees.categories.get(album.categorie)?.nom ?? album.categorie;

  const entete = document.createElement('div');
  entete.className = 'fiche';
  const infos = document.createElement('div');
  infos.className = 'fiche-infos';
  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = t(`type.${album.type}`);
  const artiste = document.createElement('p');
  artiste.className = 'fiche-artiste';
  artiste.append(lienDeLArtiste(album.artiste));

  const meta = document.createElement('dl');
  meta.className = 'meta';
  const lignes: [string, string][] = [
    [t('piste.categorie'), categorie],
    ...(album.date !== undefined
      ? [[t('piste.date'), formaterDate(album.date)] as [string, string]]
      : []),
    [comptePistes(album.nombrePistes), ''],
    [t('album.duree_totale'), formaterDuree(album.duree)],
    ...(album.reference !== undefined
      ? [[t('album.reference'), album.reference] as [string, string]]
      : []),
    [t('piste.licence'), album.licence],
    [t('piste.copyright'), album.copyright],
  ];
  for (const [terme, valeur] of lignes) {
    if (valeur === '') continue;
    meta.append(...definition(terme, valeur));
  }

  const lireAlbum = document.createElement('button');
  lireAlbum.type = 'button';
  lireAlbum.className = 'bouton bouton-principal';
  lireAlbum.textContent = t('album.lire');
  lireAlbum.setAttribute('aria-label', `${t('album.lire')} : ${album.titre}`);
  lireAlbum.addEventListener('click', () => lecteur.charger(pistes, 0));

  infos.append(titrePage(album.titre), badge, artiste);
  if (album.description !== '') {
    const description = document.createElement('p');
    description.textContent = album.description;
    infos.append(description);
  }
  const hashtags = chipsHashtags(album.hashtags);
  if (hashtags !== undefined) infos.append(hashtags);
  const actions = document.createElement('div');
  actions.className = 'carte-actions';
  actions.append(
    lireAlbum,
    boutonFile(album.titre, () => pistes),
    boutonJaimeAlbum(album),
    boutonPlaylist(album.titre, () => album.pistes),
  );
  infos.append(
    meta,
    actions,
    ...(album.telechargement && reglages.options.telechargements
      ? [blocTelechargement(donnees, album)]
      : []),
    blocPartage({ type: 'album', id: album.id, titre: album.titre }),
  );
  entete.append(pochette(album.pochette, 'pochette-grande'), infos);

  const blocs: HTMLElement[] = [entete];
  const disques = [...new Set(pistes.map((p) => p.disque ?? 1))].sort((a, b) => a - b);
  const sectionPistes = document.createElement('section');
  sectionPistes.append(sousTitre(comptePistes(pistes.length)));
  if (disques.length > 1) {
    for (const disque of disques) {
      const groupe = document.createElement('section');
      const titreDisque = document.createElement('h3');
      titreDisque.textContent = tv('album.disque', { n: disque });
      groupe.append(
        titreDisque,
        listeDePistes(
          pistes.filter((p) => (p.disque ?? 1) === disque),
          pistes,
        ),
      );
      sectionPistes.append(groupe);
    }
  } else {
    sectionPistes.append(listeDePistes(pistes, pistes));
  }
  blocs.push(sectionPistes);

  const autres = albumsLies(donnees, album, 6);
  if (autres.length > 0) {
    const sectionAutres = document.createElement('section');
    sectionAutres.append(
      sousTitre(t('album.autres')),
      grille(autres.map((a) => carteAlbum(donnees, a))),
    );
    blocs.push(sectionAutres);
  }
  return blocs;
}

export function pageAlbum(id: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => {
    const album = donnees.albums.get(id);
    definirTitrePage(album === undefined ? t('album.introuvable') : album.titre);
    return album === undefined ? [introuvable(t('album.introuvable'))] : detail(donnees, album);
  });
  return page;
}
