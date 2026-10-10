// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { compteAlbums, comptePistes } from '../i18n/format';
import { annoncer } from '../ui/annonceur';
import { choisirOption, confirmer } from '../ui/dialogue';
import {
  fichiersDeContenu,
  ligneCategorie,
  planOrdreCategories,
  planSuppressionCategorie,
  trierCategories,
  type LigneCategorie,
} from './categories';
import type { CategorieDepot } from './depot';
import { element } from './dom';
import type { Espace } from './espace';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { libelleErreurCategorie } from './ui-categorie';

export interface ActionsCategories {
  nouvelle: () => void;
  modifier: (categorie: CategorieDepot) => void;
  /** Une opération est terminée : recharger la liste avec ce message. */
  termine: (message: string) => void;
}

/** Liste des catégories dans l'ordre d'affichage du site : réordonner, créer, modifier, supprimer. */
export function construireCategories(espace: Espace, actions: ActionsCategories): HTMLElement {
  const racine = element('section', 'admin-categories');
  racine.setAttribute('aria-labelledby', 'admin-categories-titre');
  const titre = element('h2', undefined, t('admin.cat.titre'));
  titre.id = 'admin-categories-titre';
  const etat = element('p', 'carte-meta', t('admin.liste.chargement'));
  etat.setAttribute('role', 'status');
  racine.append(titre, etat);

  void (async () => {
    try {
      const depot = await espace.depot();
      const fiches = await espace.fichesCategoriesDe(depot.categoriesDepot);
      const lignes = depot.categoriesDepot.map((c) => ligneCategorie(c, fiches.get(c.dossier)));
      etat.remove();
      racine.append(...construireListe(espace, depot, lignes, fiches, actions));
    } catch (erreur) {
      etat.setAttribute('role', 'alert');
      etat.textContent = messageErreur(erreur);
    }
  })();
  return racine;
}

function construireListe(
  espace: Espace,
  depot: Awaited<ReturnType<Espace['depot']>>,
  lignes: LigneCategorie[],
  fiches: Awaited<ReturnType<Espace['fichesCategoriesDe']>>,
  actions: ActionsCategories,
): HTMLElement[] {
  const langue = document.documentElement.lang;
  let ordre = trierCategories(lignes, langue);
  const ordreEnregistre = ordre.map((l) => l.dossier).join('\n');
  let occupe = false;

  const nouvelle = element('button', 'bouton bouton-principal', t('admin.cat.nouvelle'));
  nouvelle.type = 'button';
  nouvelle.addEventListener('click', actions.nouvelle);
  const note = element('p', 'carte-meta', t('admin.cat.ordre_note'));
  const enregistrerOrdre = element('button', 'bouton', t('admin.cat.enregistrer_ordre'));
  enregistrerOrdre.type = 'button';
  const retour = element('div', 'erreur-champ');
  retour.setAttribute('role', 'alert');
  const progression = creerProgression();
  const liste = element('ol', 'admin-liste');
  const vide = element('p', 'carte-meta', lignes.length === 0 ? t('admin.cat.vide') : '');

  const majOrdre = (): void => {
    enregistrerOrdre.disabled =
      occupe || ordre.map((l) => l.dossier).join('\n') === ordreEnregistre;
  };

  function rendre(focus?: { dossier: string; action: 'monter' | 'descendre' }): void {
    liste.replaceChildren(...ordre.map(ligneDeListe));
    majOrdre();
    if (focus !== undefined) {
      const item = liste.querySelector(`[data-dossier="${CSS.escape(focus.dossier)}"]`);
      const voulu = item?.querySelector<HTMLButtonElement>(`[data-action="${focus.action}"]`);
      const autre = item?.querySelector<HTMLButtonElement>(
        `[data-action="${focus.action === 'monter' ? 'descendre' : 'monter'}"]`,
      );
      (voulu?.disabled === true ? autre : voulu)?.focus();
    }
  }

  function ligneDeListe(ligne: LigneCategorie, index: number): HTMLElement {
    const item = element('li', 'admin-ligne');
    item.dataset['dossier'] = ligne.dossier;
    const pastille = element('span', 'admin-pastille');
    pastille.setAttribute('aria-hidden', 'true');
    if (ligne.couleur !== '') pastille.style.background = ligne.couleur;

    const corps = element('div', 'admin-ligne-corps');
    corps.append(element('strong', undefined, ligne.nom));
    const details = [ligne.dossier, comptePistes(ligne.pistes), compteAlbums(ligne.albums)].join(
      ' · ',
    );
    corps.append(element('div', 'carte-meta', details));
    if (ligne.description !== '') corps.append(element('div', 'carte-meta', ligne.description));

    const monter = element('button', 'bouton', '↑');
    monter.type = 'button';
    monter.dataset['action'] = 'monter';
    monter.setAttribute('aria-label', tv('admin.cat.monter', { nom: ligne.nom }));
    monter.disabled = index === 0;
    const descendre = element('button', 'bouton', '↓');
    descendre.type = 'button';
    descendre.dataset['action'] = 'descendre';
    descendre.setAttribute('aria-label', tv('admin.cat.descendre', { nom: ligne.nom }));
    descendre.disabled = index === ordre.length - 1;
    const bouger = (sens: -1 | 1, action: 'monter' | 'descendre'): void => {
      const i = ordre.findIndex((l) => l.dossier === ligne.dossier);
      const j = i + sens;
      const autre = ordre[j];
      if (autre === undefined) return;
      ordre = [...ordre];
      ordre[i] = autre;
      ordre[j] = ligne;
      rendre({ dossier: ligne.dossier, action });
      annoncer(tv('admin.album.deplacee', { titre: ligne.nom, n: j + 1 }));
    };
    monter.addEventListener('click', () => bouger(-1, 'monter'));
    descendre.addEventListener('click', () => bouger(1, 'descendre'));

    const modifier = element('button', 'bouton', t('admin.liste.modifier'));
    modifier.type = 'button';
    modifier.setAttribute('aria-label', `${t('admin.liste.modifier')} : ${ligne.nom}`);
    modifier.addEventListener('click', () => actions.modifier(ligne.categorie));
    const supprimer = element('button', 'bouton', t('admin.liste.supprimer'));
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', `${t('admin.liste.supprimer')} : ${ligne.nom}`);
    supprimer.addEventListener('click', () => void supprimerCategorie(ligne));

    const boutons = element('div', 'admin-actions');
    boutons.append(monter, descendre, modifier, supprimer);
    item.append(pastille, corps, boutons);
    return item;
  }

  async function publier(
    message: string,
    changements: Parameters<Espace['client']['commit']>[1],
    succes: string,
  ): Promise<void> {
    occupe = true;
    majOrdre();
    retour.textContent = '';
    progression.demarrer();
    try {
      await espace.client.commit(message, changements, (a) => progression.mettreAJour(a));
      espace.invalider();
      annoncer(succes);
      actions.termine(succes);
    } catch (erreur) {
      progression.terminer();
      retour.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      occupe = false;
      majOrdre();
    }
  }

  enregistrerOrdre.addEventListener('click', () => {
    if (occupe) return;
    const plan = planOrdreCategories(
      ordre.map((l) => l.categorie),
      fiches,
    );
    if (plan.changements.length === 0) return;
    void publier(plan.message, plan.changements, t('admin.cat.ordre_ok'));
  });

  async function supprimerCategorie(ligne: LigneCategorie): Promise<void> {
    if (occupe) return;
    retour.textContent = '';
    const categorie = ligne.categorie;
    const fiche = fiches.get(categorie.dossier);
    // Sans destination, le plan n'aboutit que si la catégorie est vide (seules sa fiche et sa pochette partent).
    const sonde = planSuppressionCategorie({ categorie, fiche, depot });
    let destination: string | undefined;
    if (sonde.ok) {
      const confirme = await confirmer(
        tv('admin.cat.supprimer_vide', { nom: ligne.nom }),
        t('admin.cat.supprimer_titre'),
      );
      if (!confirme) return;
    } else {
      const autres = depot.categoriesDepot.filter((c) => c.dossier !== categorie.dossier);
      if (autres.length === 0) {
        retour.replaceChildren(element('p', undefined, t('admin.cat.err_aucune_autre')));
        return;
      }
      destination = await choisirOption(
        t('admin.cat.supprimer_titre'),
        tv('admin.cat.supprimer_contenu', {
          nom: ligne.nom,
          n: fichiersDeContenu(categorie, fiche).length,
        }),
        t('admin.cat.supprimer_destination'),
        autres.map((c) => ({ valeur: c.dossier, libelle: c.dossier })),
        t('admin.albums.supprimer_confirmer'),
      );
      if (destination === undefined) return;
    }
    const plan = planSuppressionCategorie({
      categorie,
      fiche,
      ...(destination !== undefined && { destination }),
      depot,
    });
    if (!plan.ok) {
      retour.replaceChildren(
        ...plan.erreurs.map((e) => element('p', undefined, libelleErreurCategorie(e))),
      );
      return;
    }
    await publier(plan.message, plan.changements, t('admin.cat.supprimer_ok'));
  }

  rendre();
  return [nouvelle, note, enregistrerOrdre, progression.element, retour, vide, liste];
}
