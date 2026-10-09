// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { playlists } from '../playlists';
import { annoncer } from './annonceur';

let compteur = 0;

interface DialogueOuvert {
  dialogue: HTMLDialogElement;
  corps: HTMLElement;
  /** Ferme la boîte ; elle est retirée de la page et le focus revient à l'élément qui l'a ouverte. */
  fermer: () => void;
  /** Résolue quand la boîte est fermée, par une action ou par la touche Échap. */
  fermee: Promise<void>;
}

/**
 * Ouvre une boîte de dialogue modale native (`<dialog>`) : focus piégé, fond inerte, fermeture par
 * Échap. Le focus est rendu à l'élément précédemment actif à la fermeture.
 */
function ouvrir(titre: string): DialogueOuvert {
  const precedent = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  const dialogue = document.createElement('dialog');
  dialogue.className = 'dialogue';
  const identifiant = `dialogue-${(compteur += 1)}`;
  dialogue.setAttribute('aria-labelledby', identifiant);

  const enTete = document.createElement('h2');
  enTete.id = identifiant;
  enTete.textContent = titre;
  const corps = document.createElement('div');
  corps.className = 'dialogue-corps';
  dialogue.append(enTete, corps);
  document.body.append(dialogue);

  const fermee = new Promise<void>((resoudre) => {
    dialogue.addEventListener('close', () => {
      dialogue.remove();
      precedent?.focus();
      resoudre();
    });
  });
  dialogue.showModal();
  return { dialogue, corps, fermer: () => dialogue.close(), fermee };
}

function bouton(texte: string, classe = 'bouton'): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.textContent = texte;
  return b;
}

/** Demande une confirmation ; `true` si l'utilisateur confirme, `false` s'il annule ou appuie sur Échap. */
export async function confirmer(message: string, titre: string): Promise<boolean> {
  const { corps, fermer, fermee } = ouvrir(titre);
  let confirme = false;
  const texte = document.createElement('p');
  texte.textContent = message;
  const actions = document.createElement('div');
  actions.className = 'dialogue-actions';
  const annuler = bouton(t('dialogue.annuler'));
  const valider = bouton(t('dialogue.confirmer'), 'bouton bouton-principal');
  annuler.addEventListener('click', fermer);
  valider.addEventListener('click', () => {
    confirme = true;
    fermer();
  });
  actions.append(annuler, valider);
  corps.append(texte, actions);
  // Le focus initial est sur « Annuler » : une validation accidentelle ne supprime rien.
  annuler.focus();
  await fermee;
  return confirme;
}

/**
 * Boîte « Ajouter à une playlist » : choisir une playlist existante ou en créer une nouvelle qui
 * reçoit les pistes. Annonce le résultat aux lecteurs d'écran.
 */
export function choisirPlaylist(titre: string, pistes: readonly string[]): void {
  const { corps, fermer } = ouvrir(`${t('playlist.choisir')} : ${titre}`);

  const liste = document.createElement('ul');
  liste.className = 'dialogue-liste';
  const existantes = playlists.toutes();
  if (existantes.length === 0) {
    const vide = document.createElement('p');
    vide.textContent = t('playlist.vide_liste');
    corps.append(vide);
  }
  for (const playlist of existantes) {
    const element = document.createElement('li');
    const choix = bouton(playlist.nom);
    choix.addEventListener('click', () => {
      const ajoutees = playlists.ajouterPistes(playlist.id, pistes);
      annoncer(tv(ajoutees > 0 ? 'playlist.ajoute' : 'playlist.deja', { nom: playlist.nom }));
      fermer();
    });
    element.append(choix);
    liste.append(element);
  }
  if (existantes.length > 0) corps.append(liste);

  const formulaire = document.createElement('form');
  formulaire.className = 'dialogue-formulaire';
  const etiquette = document.createElement('label');
  etiquette.className = 'champ';
  const libelle = document.createElement('span');
  libelle.textContent = t('playlist.nouvelle');
  const saisie = document.createElement('input');
  saisie.type = 'text';
  saisie.name = 'nom';
  saisie.autocomplete = 'off';
  saisie.maxLength = 80;
  etiquette.append(libelle, saisie);
  const erreur = document.createElement('p');
  erreur.setAttribute('role', 'alert');
  erreur.className = 'erreur-champ';
  const creer = document.createElement('button');
  creer.type = 'submit';
  creer.className = 'bouton bouton-principal';
  creer.textContent = t('playlist.creer');
  const annuler = bouton(t('dialogue.annuler'));
  annuler.addEventListener('click', fermer);
  const actions = document.createElement('div');
  actions.className = 'dialogue-actions';
  actions.append(annuler, creer);
  formulaire.append(etiquette, erreur, actions);
  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    const playlist = playlists.creer(saisie.value, pistes);
    if (playlist === undefined) {
      erreur.textContent = t('playlist.nom_requis');
      saisie.setAttribute('aria-invalid', 'true');
      saisie.focus();
      return;
    }
    annoncer(tv('playlist.creee', { nom: playlist.nom }));
    fermer();
  });
  corps.append(formulaire);
}
