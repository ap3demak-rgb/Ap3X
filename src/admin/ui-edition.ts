// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import { creerChampsPiste } from './champs-piste';
import { champ, element } from './dom';
import { formulaireDepuisFiche, planModification, type ErreurEdition } from './edition';
import type { DepotAnalyse, Espace } from './espace';
import { DEPOT } from './github';
import type { LignePiste } from './liste';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { surveillerModifications } from './sortie';

/** Adresse publique d'un fichier du dépôt (le dépôt est public), pour afficher la pochette actuelle. */
function adresseBrute(chemin: string): string {
  const segments = chemin.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${DEPOT.proprietaire}/${DEPOT.nom}/${DEPOT.branche}/${segments}`;
}

/**
 * Formulaire de modification d'une piste : fiche, remplacement du MP3 ou de la pochette, changement de
 * catégorie (le fichier est déplacé) ou publication d'un brouillon, le tout dans un seul commit.
 * `terminer` est appelé avec un message de succès, ou sans argument si l'utilisateur annule.
 */
export function construireEdition(
  espace: Espace,
  ligne: LignePiste,
  terminer: (message?: string) => void,
): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-edition-titre');
  const titre = element('h2', undefined, `${t('admin.edition.titre')} : ${ligne.titre}`);
  titre.id = 'admin-edition-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  Promise.all([espace.depot(), espace.ficheBrute(ligne.piste)])
    .then(([depot, fiche]) => {
      chargement.remove();
      racine.append(formulaire(espace, depot, ligne, fiche, terminer));
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
      const retour = element('button', 'bouton', t('admin.edition.annuler'));
      retour.type = 'button';
      retour.addEventListener('click', () => terminer());
      racine.append(retour);
    });
  return racine;
}

function formulaire(
  espace: Espace,
  depot: DepotAnalyse,
  ligne: LignePiste,
  fiche: Awaited<ReturnType<Espace['ficheBrute']>>,
  terminer: (message?: string) => void,
): HTMLFormElement {
  const { piste } = ligne;
  const f = element('form', 'admin-formulaire');
  f.noValidate = true;
  const modifications = surveillerModifications(f);
  let nouveauMp3: File | undefined;
  let adresseMp3: string | undefined;
  let envoiEnCours = false;

  const champs = creerChampsPiste(depot, {
    audio: () => adresseMp3,
    base: () => piste.base,
    ...(piste.image !== undefined && {
      pochetteActuelle: () => adresseBrute(piste.image?.chemin ?? ''),
    }),
  });
  champs.ecrire(formulaireDepuisFiche(piste, fiche));

  const enAlbum = piste.album !== undefined;
  const noteAlbum = element('p', 'carte-meta', enAlbum ? t('admin.edition.album_note') : '');
  if (enAlbum) champs.saisies.categorie.disabled = true;

  const saisieMp3 = element('input');
  saisieMp3.type = 'file';
  saisieMp3.accept = 'audio/mpeg,.mp3';
  saisieMp3.addEventListener('change', () => {
    nouveauMp3 = saisieMp3.files?.[0];
    if (adresseMp3 !== undefined) URL.revokeObjectURL(adresseMp3);
    adresseMp3 = nouveauMp3 === undefined ? undefined : URL.createObjectURL(nouveauMp3);
  });

  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = creerProgression();
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.edition.enregistrer'));
  enregistrer.type = 'submit';
  const annuler = element('button', 'bouton', t('admin.edition.annuler'));
  annuler.type = 'button';
  annuler.addEventListener('click', () => {
    modifications.oublier();
    terminer();
  });
  const actions = element('div', 'admin-actions');
  actions.append(enregistrer, annuler);

  f.append(
    ...champs.elements,
    noteAlbum,
    champ(t('admin.edition.remplacer_mp3'), saisieMp3),
    actions,
    progression.element,
    erreurs,
  );

  const libelles = (erreur: ErreurEdition): string => {
    switch (erreur.champ) {
      case 'titre':
        return t('admin.nouvelle.err_titre');
      case 'categorie':
        return t('admin.nouvelle.err_categorie');
      case 'date':
        return t('admin.nouvelle.err_date');
      case 'doublon':
        return tv('admin.nouvelle.err_doublon', { id: erreur.id ?? '' });
      case 'album':
        return t('admin.edition.err_album');
      case 'deplacement':
        return t('admin.edition.err_deplacement');
      case 'fichier':
        return t('admin.nouvelle.err_fichier');
    }
  };

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;
    void enregistrerLesChangements();
  });

  async function enregistrerLesChangements(): Promise<void> {
    erreurs.textContent = '';
    for (const controle of Object.values(champs.controles))
      controle.removeAttribute('aria-invalid');
    envoiEnCours = true;
    enregistrer.disabled = true;
    try {
      const pochette = champs.pochette();
      const formulaireSaisi = champs.lire();
      // Une catégorie verrouillée (piste d'album) garde sa valeur d'origine.
      if (enAlbum) formulaireSaisi.categorie = piste.categorie;
      const plan = planModification(
        {
          piste,
          fiche,
          formulaire: formulaireSaisi,
          ...(nouveauMp3 !== undefined && {
            nouveauMp3: new Uint8Array(await nouveauMp3.arrayBuffer()),
          }),
          ...(pochette !== undefined && {
            pochette: {
              octets: new Uint8Array(await pochette.blob.arrayBuffer()),
              extension: pochette.extension,
            },
          }),
        },
        depot,
      );
      if (!plan.ok) {
        for (const e of plan.erreurs) {
          if (e.champ === 'titre' || e.champ === 'categorie' || e.champ === 'date') {
            champs.controles[e.champ].setAttribute('aria-invalid', 'true');
          } else if (e.champ === 'doublon') {
            champs.controles.categorie.setAttribute('aria-invalid', 'true');
          }
        }
        erreurs.replaceChildren(...plan.erreurs.map((e) => element('p', undefined, libelles(e))));
        const premier = plan.erreurs[0]?.champ;
        if (premier === 'titre' || premier === 'categorie' || premier === 'date') {
          champs.controles[premier].focus();
        }
        return;
      }
      if (plan.changements.length === 0) {
        erreurs.replaceChildren(element('p', undefined, t('admin.edition.rien')));
        return;
      }
      progression.demarrer();
      await espace.client.commit(plan.message, plan.changements, (avancement) =>
        progression.mettreAJour(avancement),
      );
      modifications.oublier();
      espace.invalider();
      annoncer(t('admin.edition.ok'));
      terminer(t('admin.edition.ok'));
    } catch (erreur) {
      progression.terminer();
      erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      envoiEnCours = false;
      enregistrer.disabled = false;
    }
  }

  return f;
}
