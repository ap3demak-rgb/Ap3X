// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Donnees } from '../catalogue/donnees';
import type { Piste } from '../catalogue/schemas';
import { t, tv } from '../i18n';
import { comptePistes } from '../i18n/format';
import { lecteur } from '../lecteur';
import { ImportInvalide, LONGUEUR_NOM_MAX, playlists, type Playlist } from '../playlists';
import { lienPlaylist } from '../routeur';
import { annoncer } from '../ui/annonceur';
import { lien } from '../ui/cartes';
import { definirTitrePage, remplirAvecCatalogue, sousTitre, titrePage } from './commun';

/** Pistes d'une playlist qui existent encore dans le catalogue, avec leur position dans la playlist. */
export function pistesDePlaylist(
  donnees: Donnees,
  playlist: Playlist,
): { piste: Piste; index: number }[] {
  const resultat: { piste: Piste; index: number }[] = [];
  playlist.pistes.forEach((id, index) => {
    const piste = donnees.pistes.get(id);
    if (piste !== undefined) resultat.push({ piste, index });
  });
  return resultat;
}

function formulaireCreation(): HTMLFormElement {
  const formulaire = document.createElement('form');
  formulaire.className = 'formulaire-ligne';
  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const texte = document.createElement('span');
  texte.textContent = t('playlist.nom');
  const saisie = document.createElement('input');
  saisie.type = 'text';
  saisie.name = 'nom';
  saisie.autocomplete = 'off';
  saisie.maxLength = LONGUEUR_NOM_MAX;
  etiquette.append(texte, saisie);
  const creer = document.createElement('button');
  creer.type = 'submit';
  creer.className = 'bouton bouton-principal';
  creer.textContent = t('playlist.creer');
  const erreur = document.createElement('p');
  erreur.className = 'erreur-champ';
  erreur.setAttribute('role', 'alert');
  formulaire.append(etiquette, creer, erreur);
  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    const playlist = playlists.creer(saisie.value);
    if (playlist === undefined) {
      erreur.textContent = t('playlist.nom_requis');
      saisie.setAttribute('aria-invalid', 'true');
      saisie.focus();
      return;
    }
    erreur.textContent = '';
    saisie.removeAttribute('aria-invalid');
    saisie.value = '';
    annoncer(tv('playlist.creee', { nom: playlist.nom }));
  });
  return formulaire;
}

function telechargerExport(): void {
  const blob = new Blob([playlists.exporter()], { type: 'application/json' });
  const adresse = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = adresse;
  a.download = 'playlists-ap3x.json';
  document.body.append(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(adresse);
}

function sectionImportExport(): HTMLElement {
  const section = document.createElement('section');
  section.append(sousTitre(`${t('playlist.exporter')} / ${t('playlist.importer')}`));
  const barre = document.createElement('div');
  barre.className = 'filtres';

  const exporter = document.createElement('button');
  exporter.type = 'button';
  exporter.className = 'bouton';
  exporter.textContent = t('playlist.exporter');
  exporter.addEventListener('click', telechargerExport);

  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const texte = document.createElement('span');
  texte.textContent = t('playlist.importer');
  const fichier = document.createElement('input');
  fichier.type = 'file';
  fichier.accept = 'application/json,.json';
  etiquette.append(texte, fichier);

  const message = document.createElement('p');
  message.setAttribute('role', 'status');
  message.className = 'carte-meta';

  const actualiserExport = (): void => {
    if (!exporter.isConnected) {
      playlists.removeEventListener('change', actualiserExport);
      return;
    }
    exporter.disabled = playlists.toutes().length === 0;
  };
  playlists.addEventListener('change', actualiserExport);
  exporter.disabled = playlists.toutes().length === 0;

  fichier.addEventListener('change', () => {
    const choisi = fichier.files?.[0];
    if (choisi === undefined) return;
    choisi
      .text()
      .then((contenu) => {
        const { ajoutees } = playlists.importer(contenu);
        message.removeAttribute('role');
        message.setAttribute('role', 'status');
        message.textContent = tv('playlist.import_ok', { n: ajoutees });
      })
      .catch((erreur: unknown) => {
        message.setAttribute('role', 'alert');
        message.textContent =
          erreur instanceof ImportInvalide ? t('playlist.import_erreur') : t('erreur.chargement');
      })
      .finally(() => {
        fichier.value = '';
      });
  });

  barre.append(exporter, etiquette);
  section.append(barre, message);
  return section;
}

/** Page « Playlists » : créer, lister, exporter et importer les playlists du visiteur. */
export function pagePlaylists(): HTMLElement {
  definirTitrePage(t('nav.playlists'));
  const page = document.createElement('section');
  page.append(titrePage(t('nav.playlists')), formulaireCreation());

  remplirAvecCatalogue(page, (donnees) => {
    const zone = document.createElement('div');
    zone.className = 'zone-collection';
    const afficher = (): void => {
      if (!zone.isConnected && zone.dataset['monte'] === 'oui') {
        playlists.removeEventListener('change', afficher);
        return;
      }
      if (zone.isConnected) zone.dataset['monte'] = 'oui';
      zone.replaceChildren();
      const toutes = playlists.toutes();
      if (toutes.length === 0) {
        const vide = document.createElement('p');
        vide.textContent = t('playlist.vide_liste');
        zone.append(vide);
        return;
      }
      const liste = document.createElement('ul');
      liste.className = 'liste-categories liste-categories-grande';
      for (const playlist of toutes) {
        const disponibles = pistesDePlaylist(donnees, playlist);
        const element = document.createElement('li');
        const titre = document.createElement('h2');
        titre.append(lien(lienPlaylist(playlist.id), playlist.nom));
        const compte = document.createElement('p');
        compte.className = 'carte-meta';
        compte.textContent = comptePistes(disponibles.length);
        const lire = document.createElement('button');
        lire.type = 'button';
        lire.className = 'bouton';
        lire.textContent = t('lecteur.lecture');
        lire.setAttribute('aria-label', `${t('lecteur.lire_tout')} : ${playlist.nom}`);
        lire.disabled = disponibles.length === 0;
        lire.addEventListener('click', () => {
          lecteur.charger(
            disponibles.map((d) => d.piste),
            0,
          );
        });
        element.append(titre, compte, lire);
        liste.append(element);
      }
      zone.append(liste);
    };
    afficher();
    playlists.addEventListener('change', afficher);
    return [zone, sectionImportExport()];
  });
  return page;
}
