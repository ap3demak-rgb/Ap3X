// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Donnees } from '../catalogue/donnees';
import { t, tv } from '../i18n';
import { comptePistes, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { icone, type NomIcone } from '../lecteur/icones';
import { LONGUEUR_NOM_MAX, playlists } from '../playlists';
import { lienPiste } from '../routeur';
import { annoncer } from '../ui/annonceur';
import { lien, lienDeLArtiste } from '../ui/cartes';
import { confirmer } from '../ui/dialogue';
import { definirTitrePage, introuvable, remplirAvecCatalogue, titrePage } from './commun';
import { pistesDePlaylist } from './playlists';

function boutonIcone(nom: NomIcone, libelle: string, actif: boolean): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bouton-icone';
  b.append(icone(nom));
  b.setAttribute('aria-label', libelle);
  b.disabled = !actif;
  return b;
}

function detail(donnees: Donnees, id: string): HTMLElement[] {
  const initiale = playlists.obtenir(id);
  if (initiale === undefined) {
    definirTitrePage(t('playlist.introuvable'));
    return [introuvable(t('playlist.introuvable'))];
  }
  definirTitrePage(initiale.nom);

  const entete = document.createElement('header');
  entete.className = 'entete-collection';
  const titre = titrePage(initiale.nom);
  const compte = document.createElement('p');
  compte.className = 'carte-meta';
  entete.append(titre, compte);

  // Renommer
  const renommer = document.createElement('form');
  renommer.className = 'formulaire-ligne';
  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const libelle = document.createElement('span');
  libelle.textContent = t('playlist.nom');
  const saisie = document.createElement('input');
  saisie.type = 'text';
  saisie.autocomplete = 'off';
  saisie.maxLength = LONGUEUR_NOM_MAX;
  saisie.value = initiale.nom;
  etiquette.append(libelle, saisie);
  const enregistrer = document.createElement('button');
  enregistrer.type = 'submit';
  enregistrer.className = 'bouton';
  enregistrer.textContent = t('playlist.enregistrer');
  enregistrer.setAttribute('aria-label', `${t('playlist.renommer')} : ${initiale.nom}`);
  const erreur = document.createElement('p');
  erreur.className = 'erreur-champ';
  erreur.setAttribute('role', 'alert');
  renommer.append(etiquette, enregistrer, erreur);
  renommer.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (!playlists.renommer(id, saisie.value)) {
      erreur.textContent = t('playlist.nom_requis');
      saisie.setAttribute('aria-invalid', 'true');
      saisie.focus();
      return;
    }
    erreur.textContent = '';
    saisie.removeAttribute('aria-invalid');
    annoncer(t('playlist.renommee'));
  });

  // Commandes
  const commandes = document.createElement('div');
  commandes.className = 'filtres';
  const lireTout = document.createElement('button');
  lireTout.type = 'button';
  lireTout.className = 'bouton bouton-principal';
  lireTout.textContent = t('lecteur.lire_tout');
  const supprimer = document.createElement('button');
  supprimer.type = 'button';
  supprimer.className = 'bouton';
  supprimer.textContent = t('playlist.supprimer');
  commandes.append(lireTout, supprimer);

  const zone = document.createElement('div');
  zone.tabIndex = -1;
  zone.className = 'zone-collection';
  const note = document.createElement('p');
  note.className = 'carte-meta';

  /** Bouton à refocaliser après le prochain affichage (déplacement d'une piste au clavier). */
  let focusApres: { index: number; action: 'monter' | 'descendre' } | undefined;

  const afficher = (): void => {
    const playlist = playlists.obtenir(id);
    if (!zone.isConnected && zone.dataset['monte'] === 'oui') {
      playlists.removeEventListener('change', afficher);
      return;
    }
    if (zone.isConnected) zone.dataset['monte'] = 'oui';
    if (playlist === undefined) return;
    titre.textContent = playlist.nom;
    saisie.value = playlist.nom;
    definirTitrePage(playlist.nom);
    const disponibles = pistesDePlaylist(donnees, playlist);
    const indisponibles = playlist.pistes.length - disponibles.length;
    compte.textContent = comptePistes(disponibles.length);
    lireTout.disabled = disponibles.length === 0;
    lireTout.setAttribute('aria-label', `${t('lecteur.lire_tout')} : ${playlist.nom}`);
    supprimer.setAttribute('aria-label', `${t('playlist.supprimer')} : ${playlist.nom}`);
    note.textContent =
      indisponibles > 0 ? tv('playlist.pistes_indisponibles', { n: indisponibles }) : '';

    zone.replaceChildren();
    if (disponibles.length === 0) {
      const vide = document.createElement('p');
      vide.textContent = t('playlist.vide');
      zone.append(vide, note);
      return;
    }
    const liste = document.createElement('ol');
    liste.className = 'liste-titres';
    const pistes = disponibles.map((d) => d.piste);
    disponibles.forEach(({ piste, index }, position) => {
      const ligne = document.createElement('li');
      const description = `${piste.titre} – ${piste.artiste}`;
      const lire = document.createElement('button');
      lire.type = 'button';
      lire.className = 'bouton';
      lire.textContent = t('lecteur.lecture');
      lire.setAttribute('aria-label', `${t('lecteur.lecture')} : ${description}`);
      lire.addEventListener('click', () => lecteur.charger(pistes, position));
      const nom = document.createElement('span');
      nom.className = 'titre-nom';
      nom.append(lien(lienPiste(piste.id), piste.titre), ' – ', lienDeLArtiste(piste.artiste));
      const duree = document.createElement('span');
      duree.className = 'titre-duree';
      duree.textContent = formaterDuree(piste.duree);

      const monter = boutonIcone('monter', `${t('lecteur.monter')} : ${piste.titre}`, index > 0);
      monter.dataset['action'] = 'monter';
      monter.dataset['index'] = String(index);
      monter.addEventListener('click', () => {
        focusApres = { index: index - 1, action: 'monter' };
        playlists.deplacerPiste(id, index, index - 1);
      });
      const dernier = playlist.pistes.length - 1;
      const descendre = boutonIcone(
        'descendre',
        `${t('lecteur.descendre')} : ${piste.titre}`,
        index < dernier,
      );
      descendre.dataset['action'] = 'descendre';
      descendre.dataset['index'] = String(index);
      descendre.addEventListener('click', () => {
        focusApres = { index: index + 1, action: 'descendre' };
        playlists.deplacerPiste(id, index, index + 1);
      });
      const retirer = boutonIcone(
        'retirer',
        `${t('playlist.retirer_piste')} : ${piste.titre}`,
        true,
      );
      retirer.addEventListener('click', () => {
        focusApres = undefined;
        playlists.retirerPiste(id, index);
        zone.focus({ preventScroll: true });
      });
      ligne.append(lire, nom, duree, monter, descendre, retirer);
      liste.append(ligne);
    });
    zone.append(liste, note);

    if (focusApres !== undefined) {
      const { index, action } = focusApres;
      const cible = zone.querySelector<HTMLButtonElement>(
        `button[data-action="${action}"][data-index="${index}"]`,
      );
      // Si le bouton est désactivé (début ou fin de liste), le focus passe à l'autre sens.
      if (cible !== null && !cible.disabled) cible.focus();
      else
        zone
          .querySelector<HTMLButtonElement>(`button[data-index="${index}"]:not(:disabled)`)
          ?.focus();
      focusApres = undefined;
    }
  };

  lireTout.addEventListener('click', () => {
    const playlist = playlists.obtenir(id);
    if (playlist === undefined) return;
    lecteur.charger(
      pistesDePlaylist(donnees, playlist).map((d) => d.piste),
      0,
    );
  });
  supprimer.addEventListener('click', () => {
    const playlist = playlists.obtenir(id);
    if (playlist === undefined) return;
    void confirmer(
      tv('playlist.confirmer_suppression', { nom: playlist.nom }),
      t('playlist.supprimer'),
    ).then((confirme) => {
      if (!confirme) return;
      playlists.supprimer(id);
      annoncer(tv('playlist.supprimee', { nom: playlist.nom }));
      window.location.hash = '#/playlists';
    });
  });

  playlists.addEventListener('change', afficher);
  afficher();
  return [entete, renommer, commandes, zone];
}

/** Page d'une playlist : renommer, supprimer, lire, réordonner et retirer des pistes. */
export function pagePlaylist(id: string): HTMLElement {
  const page = document.createElement('section');
  remplirAvecCatalogue(page, (donnees) => detail(donnees, id));
  return page;
}
