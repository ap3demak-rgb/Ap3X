// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import { confirmer } from '../ui/dialogue';
import { element } from './dom';
import type { Espace } from './espace';
import type { CommitResume } from './github';
import {
  cheminsADeterminer,
  planAnnulation,
  titreDeCommit,
  type ErreurAnnulation,
} from './historique';
import { messageErreur } from './messages';
import { creerProgression } from './progression';

const NOMBRE_COMMITS = 20;

function texteErreur(erreur: ErreurAnnulation): string {
  switch (erreur.code) {
    case 'fusion':
      return t('admin.hist.err_fusion');
    case 'trop':
      return t('admin.hist.err_trop');
    case 'conflit':
      return tv('admin.hist.err_conflit', { fichiers: erreur.chemins.join(', ') });
    case 'introuvable':
      return tv('admin.hist.err_introuvable', { fichiers: erreur.chemins.join(', ') });
  }
}

/** Historique des derniers commits, avec l'annulation d'un commit en un clic (un nouveau commit l'inverse). */
export function construireHistorique(
  espace: Espace,
  termine: (message: string) => void,
): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-hist-titre');
  const titre = element('h2', undefined, t('admin.hist.titre'));
  titre.id = 'admin-hist-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  espace.client
    .historique(NOMBRE_COMMITS)
    .then((commits) => {
      chargement.remove();
      racine.append(...liste(espace, commits, termine));
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
    });
  return racine;
}

function liste(
  espace: Espace,
  commits: CommitResume[],
  termine: (message: string) => void,
): HTMLElement[] {
  const retour = element('div', 'erreur-champ');
  retour.setAttribute('role', 'alert');
  const progression = creerProgression();
  const ol = element('ol', 'admin-liste');
  let occupe = false;
  const format = new Intl.DateTimeFormat(document.documentElement.lang, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  async function annuler(commit: CommitResume): Promise<void> {
    if (occupe) return;
    retour.textContent = '';
    const titre = titreDeCommit(commit.message);
    if (
      !(await confirmer(
        tv('admin.hist.confirmer_message', { message: titre }),
        t('admin.hist.confirmer_titre'),
      ))
    ) {
      return;
    }
    occupe = true;
    progression.demarrer();
    try {
      const detail = await espace.client.detailCommit(commit.sha);
      // Ce que la branche contient aujourd'hui, et l'état des fichiers touchés avant le commit.
      espace.invalider();
      const depot = await espace.depot();
      const parent = detail.parents[0];
      const chemins = cheminsADeterminer(detail);
      const avant = new Map<string, string | undefined>();
      if (parent !== undefined) {
        await Promise.all(
          chemins.map(async (chemin) => {
            avant.set(chemin, await espace.client.empreinteA(chemin, parent));
          }),
        );
      }
      const plan = planAnnulation(detail, depot.empreintes, avant);
      if (!plan.ok) {
        progression.terminer();
        retour.replaceChildren(element('p', undefined, texteErreur(plan.erreur)));
        return;
      }
      await espace.client.commit(plan.message, plan.changements, (a) => progression.mettreAJour(a));
      espace.invalider();
      const succes = t('admin.hist.ok');
      annoncer(succes);
      termine(succes);
    } catch (erreur) {
      progression.terminer();
      retour.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      occupe = false;
    }
  }

  for (const commit of commits) {
    const item = element('li', 'admin-ligne');
    const corps = element('div', 'admin-ligne-corps');
    corps.append(element('strong', undefined, titreDeCommit(commit.message)));
    const date = commit.date === '' ? '' : format.format(new Date(commit.date));
    corps.append(
      element(
        'div',
        'carte-meta',
        [commit.auteur, date, commit.sha.slice(0, 7)].filter((p) => p !== '').join(' · '),
      ),
    );
    const lien = element('a', undefined, t('admin.hist.voir'));
    lien.href = commit.url;
    lien.rel = 'noopener';
    const bouton = element('button', 'bouton', t('admin.hist.annuler'));
    bouton.type = 'button';
    bouton.setAttribute(
      'aria-label',
      tv('admin.hist.annuler_label', { message: titreDeCommit(commit.message) }),
    );
    // Un commit de fusion n'a pas un seul parent : il ne peut pas être annulé simplement.
    bouton.disabled = commit.parents.length !== 1;
    bouton.addEventListener('click', () => void annuler(commit));
    const actions = element('div', 'admin-actions');
    actions.append(lien, bouton);
    item.append(corps, actions);
    ol.append(item);
  }
  return [progression.element, retour, ol];
}
