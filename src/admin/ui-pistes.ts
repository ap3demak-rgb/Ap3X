// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { comptePistes } from '../i18n/format';
import { annoncer } from '../ui/annonceur';
import { confirmer } from '../ui/dialogue';
import { champ, element } from './dom';
import { planGroupe, planSuppression, type ActionGroupee } from './edition';
import type { DepotAnalyse, Espace } from './espace';
import { lireHashtags } from './fiche';
import type { Changement } from './github';
import {
  filtrerLignes,
  hashtagsDeLaListe,
  lignePiste,
  type CriteresListe,
  type LignePiste,
  type TriListe,
} from './liste';
import { messageErreur } from './messages';
import { creerProgression } from './progression';

export interface ActionsListe {
  /** Ouvre le formulaire de modification d'une piste. */
  modifier: (ligne: LignePiste) => void;
  /** Une modification groupée ou une suppression est terminée : recharger la liste avec ce message. */
  termine: (message: string) => void;
}

/** Liste des pistes du dépôt (brouillons compris) : recherche, filtres, tri, modification, suppression, actions groupées. */
export function construirePistes(espace: Espace, actions: ActionsListe): HTMLElement {
  const racine = element('section', 'admin-pistes');
  racine.setAttribute('aria-labelledby', 'admin-pistes-titre');
  const titre = element('h2', undefined, t('admin.liste.titre'));
  titre.id = 'admin-pistes-titre';
  const etat = element('p', 'carte-meta', t('admin.liste.chargement'));
  etat.setAttribute('role', 'status');
  racine.append(titre, etat);

  void (async () => {
    try {
      const depot = await espace.depot();
      const pistes = depot.pistes;
      const resumes = await espace.resumesDe(pistes, (recus) => {
        // Annonce rare : tous les dix titres, pour ne pas saturer un lecteur d'écran.
        if (recus % 10 === 0) {
          etat.textContent = `${t('admin.liste.chargement')} ${recus}/${pistes.length}`;
        }
      });
      const lignes = pistes.map((piste, i) => lignePiste(piste, resumes[i]));
      etat.remove();
      racine.append(...construireListe(espace, depot, lignes, actions));
    } catch (erreur) {
      etat.setAttribute('role', 'alert');
      etat.textContent = messageErreur(erreur);
    }
  })();
  return racine;
}

type ValeurAction = 'categorie' | 'hashtag' | 'masquer' | 'publier' | 'supprimer';

function construireListe(
  espace: Espace,
  depot: DepotAnalyse,
  lignes: LignePiste[],
  actions: ActionsListe,
): HTMLElement[] {
  const criteres: CriteresListe = { recherche: '', categorie: '', hashtag: '', tri: 'titre' };
  const selection = new Set<string>();

  const recherche = element('input');
  recherche.type = 'search';
  recherche.autocomplete = 'off';

  const selectionCategorie = element('select');
  selectionCategorie.append(new Option(t('admin.liste.toutes'), ''));
  for (const dossier of depot.categories) selectionCategorie.append(new Option(dossier, dossier));

  const selectionHashtag = element('select');
  selectionHashtag.append(new Option(t('admin.liste.tous'), ''));
  for (const hashtag of hashtagsDeLaListe(lignes)) {
    selectionHashtag.append(new Option(`#${hashtag}`, hashtag));
  }

  const selectionTri = element('select');
  selectionTri.append(
    new Option(t('admin.liste.tri_titre'), 'titre'),
    new Option(t('admin.liste.tri_categorie'), 'categorie'),
  );

  const barre = element('div', 'formulaire-ligne');
  barre.append(
    champ(t('admin.liste.recherche'), recherche),
    champ(t('admin.liste.categorie'), selectionCategorie),
    champ(t('admin.liste.hashtag'), selectionHashtag),
    champ(t('admin.liste.tri'), selectionTri),
  );

  const compte = element('p', 'carte-meta');
  compte.setAttribute('role', 'status');
  const liste = element('ul', 'admin-liste');
  const avertissement = element('p', 'carte-meta', depot.tronque ? t('admin.liste.tronque') : '');
  const retour = element('div', 'erreur-champ');
  retour.setAttribute('role', 'alert');
  const progression = creerProgression();
  let occupe = false;
  let visibles: LignePiste[] = [];

  // --- Actions groupées ------------------------------------------------------------------------
  const caseTout = element('input');
  caseTout.type = 'checkbox';
  const etiquetteTout = element('label', 'champ-case');
  etiquetteTout.append(caseTout, element('span', undefined, t('admin.liste.tout')));
  const nombreSelection = element('p', 'carte-meta');
  nombreSelection.setAttribute('role', 'status');

  const choixAction = element('select');
  const ACTIONS: [ValeurAction, string][] = [
    ['categorie', t('admin.groupe.categorie')],
    ['hashtag', t('admin.groupe.hashtag')],
    ['masquer', t('admin.groupe.masquer')],
    ['publier', t('admin.groupe.publier')],
    ['supprimer', t('admin.groupe.supprimer')],
  ];
  for (const [valeur, libelle] of ACTIONS) choixAction.append(new Option(libelle, valeur));
  const parametreCategorie = element('select');
  parametreCategorie.append(new Option('', ''));
  for (const dossier of depot.categories) parametreCategorie.append(new Option(dossier, dossier));
  const champCategorie = champ(t('admin.groupe.parametre_categorie'), parametreCategorie);
  const parametreHashtag = element('input');
  parametreHashtag.type = 'text';
  parametreHashtag.placeholder = '#ambient';
  const champHashtag = champ(t('admin.groupe.parametre_hashtag'), parametreHashtag);
  const appliquer = element('button', 'bouton bouton-principal', t('admin.groupe.appliquer'));
  appliquer.type = 'button';
  const groupe = element('div', 'formulaire-ligne');
  groupe.append(
    champ(t('admin.groupe.action'), choixAction),
    champCategorie,
    champHashtag,
    appliquer,
  );

  const majParametres = (): void => {
    champCategorie.hidden = choixAction.value !== 'categorie';
    champHashtag.hidden = choixAction.value !== 'hashtag';
  };
  choixAction.addEventListener('change', majParametres);
  majParametres();

  const majSelection = (): void => {
    nombreSelection.textContent = tv('admin.liste.selection', { n: selection.size });
    appliquer.disabled = selection.size === 0 || occupe;
    const ids = visibles.map((l) => l.id);
    caseTout.checked = ids.length > 0 && ids.every((id) => selection.has(id));
    caseTout.indeterminate = !caseTout.checked && ids.some((id) => selection.has(id));
  };

  const afficher = (): void => {
    visibles = filtrerLignes(lignes, criteres, document.documentElement.lang);
    compte.textContent =
      visibles.length === 0 ? t('admin.liste.vide') : comptePistes(visibles.length);
    liste.replaceChildren(...visibles.map(ligneDeListe));
    majSelection();
  };

  function ligneDeListe(ligne: LignePiste): HTMLElement {
    const item = element('li', 'admin-ligne');
    const choix = element('input');
    choix.type = 'checkbox';
    choix.checked = selection.has(ligne.id);
    choix.setAttribute('aria-label', tv('admin.liste.selectionner', { titre: ligne.titre }));
    choix.addEventListener('change', () => {
      if (choix.checked) selection.add(ligne.id);
      else selection.delete(ligne.id);
      majSelection();
    });

    const corps = element('div', 'admin-ligne-corps');
    const titre = element('strong', undefined, ligne.titre);
    corps.append(titre);
    if (!ligne.visible) {
      corps.append(' ', element('span', 'admin-brouillon', t('admin.liste.brouillon')));
    }
    const details = [ligne.artiste, ligne.album ?? '', ligne.categorie]
      .filter((d) => d !== '')
      .join(' · ');
    corps.append(element('div', 'carte-meta', details));
    if (ligne.hashtags.length > 0) {
      corps.append(element('div', 'carte-meta', ligne.hashtags.map((h) => `#${h}`).join(' ')));
    }

    const modifier = element('button', 'bouton', t('admin.liste.modifier'));
    modifier.type = 'button';
    modifier.setAttribute('aria-label', `${t('admin.liste.modifier')} : ${ligne.titre}`);
    modifier.addEventListener('click', () => actions.modifier(ligne));
    const supprimer = element('button', 'bouton', t('admin.liste.supprimer'));
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', `${t('admin.liste.supprimer')} : ${ligne.titre}`);
    supprimer.addEventListener('click', () => void supprimerLignes([ligne]));
    const boutons = element('div', 'admin-actions');
    boutons.append(modifier, supprimer);

    item.append(choix, corps, boutons);
    return item;
  }

  /** Publie `changements` en un commit, puis recharge la liste ; affiche l'erreur sinon. */
  async function publier(
    message: string,
    changements: Changement[],
    succes: string,
  ): Promise<void> {
    occupe = true;
    appliquer.disabled = true;
    retour.textContent = '';
    progression.demarrer();
    try {
      await espace.client.commit(message, changements, (avancement) =>
        progression.mettreAJour(avancement),
      );
      espace.invalider();
      annoncer(succes);
      actions.termine(succes);
    } catch (erreur) {
      progression.terminer();
      retour.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      occupe = false;
      majSelection();
    }
  }

  async function supprimerLignes(cibles: LignePiste[]): Promise<void> {
    if (occupe || cibles.length === 0) return;
    const plan = planSuppression(cibles);
    const retenues = cibles.length - plan.ignorees.length;
    if (retenues === 0) {
      retour.replaceChildren(element('p', undefined, t('admin.suppression.album')));
      return;
    }
    const message =
      retenues === 1
        ? tv('admin.suppression.message', {
            titre: cibles.find((c) => !plan.ignorees.includes(c))?.titre ?? '',
          })
        : tv('admin.suppression.message_lot', { n: retenues });
    const complet =
      plan.ignorees.length > 0 ? `${message} ${t('admin.suppression.album')}` : message;
    if (!(await confirmer(complet, t('admin.suppression.titre')))) return;
    await publier(plan.message, plan.changements, t('admin.suppression.ok'));
  }

  appliquer.addEventListener('click', () => void appliquerAction());

  async function appliquerAction(): Promise<void> {
    if (occupe) return;
    retour.textContent = '';
    const cibles = lignes.filter((l) => selection.has(l.id));
    if (cibles.length === 0) return;

    if (choixAction.value === 'supprimer') {
      await supprimerLignes(cibles);
      return;
    }
    let action: ActionGroupee;
    if (choixAction.value === 'categorie') {
      if (parametreCategorie.value === '') {
        retour.replaceChildren(element('p', undefined, t('admin.groupe.err_categorie')));
        parametreCategorie.focus();
        return;
      }
      action = { type: 'categorie', dossier: parametreCategorie.value };
    } else if (choixAction.value === 'hashtag') {
      const hashtag = lireHashtags(parametreHashtag.value)[0];
      if (hashtag === undefined) {
        retour.replaceChildren(element('p', undefined, t('admin.groupe.err_hashtag')));
        parametreHashtag.focus();
        return;
      }
      action = { type: 'hashtag', hashtag };
    } else {
      action = { type: 'visibilite', visible: choixAction.value === 'publier' };
    }

    occupe = true;
    appliquer.disabled = true;
    try {
      const fiches = await espace.fichesDe(cibles.map((c) => c.piste));
      const lot = planGroupe(cibles, fiches, action, depot);
      if (lot.refusees.length > 0) {
        retour.replaceChildren(
          element(
            'p',
            undefined,
            tv('admin.groupe.err_refus', {
              titres: lot.refusees.map((r) => r.ligne.titre).join(', '),
            }),
          ),
        );
        return;
      }
      if (lot.modifiees === 0) {
        retour.replaceChildren(element('p', undefined, t('admin.groupe.rien')));
        return;
      }
      occupe = false;
      await publier(lot.message, lot.changements, tv('admin.groupe.ok', { n: lot.modifiees }));
    } catch (erreur) {
      retour.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      occupe = false;
      majSelection();
    }
  }

  recherche.addEventListener('input', () => {
    criteres.recherche = recherche.value;
    afficher();
  });
  selectionCategorie.addEventListener('change', () => {
    criteres.categorie = selectionCategorie.value;
    afficher();
  });
  selectionHashtag.addEventListener('change', () => {
    criteres.hashtag = selectionHashtag.value;
    afficher();
  });
  selectionTri.addEventListener('change', () => {
    criteres.tri = selectionTri.value as TriListe;
    afficher();
  });
  caseTout.addEventListener('change', () => {
    for (const ligne of visibles) {
      if (caseTout.checked) selection.add(ligne.id);
      else selection.delete(ligne.id);
    }
    afficher();
  });
  afficher();
  return [
    barre,
    compte,
    etiquetteTout,
    nombreSelection,
    groupe,
    progression.element,
    retour,
    liste,
    avertissement,
  ];
}
