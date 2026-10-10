// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { slugifier } from '../catalogue/texte';
import { SEUILS } from '../contraste';
import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import {
  formulaireDepuisCategorie,
  planCreationCategorie,
  planModificationCategorie,
  ratioCouleur,
  type ErreurCategorie,
  type FormulaireCategorie,
} from './categories';
import { creerChampPochette } from './champs-communs';
import type { CategorieDepot } from './depot';
import { champ, element } from './dom';
import type { Espace } from './espace';
import { DEPOT } from './github';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { surveillerModifications } from './sortie';

function adresseBrute(chemin: string): string {
  const segments = chemin.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${DEPOT.proprietaire}/${DEPOT.nom}/${DEPOT.branche}/${segments}`;
}

export function libelleErreurCategorie(erreur: ErreurCategorie): string {
  switch (erreur.champ) {
    case 'nom':
      return t('admin.cat.err_nom');
    case 'reserve':
      return tv('admin.cat.err_reserve', { id: erreur.id ?? '' });
    case 'doublon':
      return tv('admin.cat.err_doublon', { id: erreur.id ?? '' });
    case 'couleur':
      return t('admin.cat.err_couleur');
    case 'contraste':
      return tv('admin.cat.err_contraste', { ratio: (erreur.ratio ?? 0).toFixed(1) });
    case 'destination':
      return t('admin.cat.err_destination');
    case 'conflit':
      return tv('admin.cat.err_conflit', { chemins: (erreur.chemins ?? []).join(', ') });
  }
}

/**
 * Formulaire de création (`categorie` absente) ou de modification d'une catégorie : nom affiché,
 * description, couleur (avec son contraste en direct) et pochette. `termine` reçoit un message de succès,
 * ou rien si l'utilisateur annule.
 */
export function construireCategorie(
  espace: Espace,
  categorie: CategorieDepot | undefined,
  termine: (message?: string) => void,
): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-cat-titre');
  const titre = element(
    'h2',
    undefined,
    categorie === undefined ? t('admin.cat.titre_nouvelle') : t('admin.cat.titre_edition'),
  );
  titre.id = 'admin-cat-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  Promise.all([
    espace.depot(),
    categorie === undefined ? Promise.resolve(undefined) : espace.ficheCategorie(categorie),
  ])
    .then(([depot, fiche]) => {
      chargement.remove();
      racine.append(formulaire(espace, depot, categorie, fiche, termine));
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
    });
  return racine;
}

function formulaire(
  espace: Espace,
  depot: Awaited<ReturnType<Espace['depot']>>,
  categorie: CategorieDepot | undefined,
  fiche: Awaited<ReturnType<Espace['ficheCategorie']>>,
  termine: (message?: string) => void,
): HTMLFormElement {
  const f = element('form', 'admin-formulaire');
  f.noValidate = true;
  const modifications = surveillerModifications(f);
  let envoiEnCours = false;

  const nom = element('input');
  nom.type = 'text';
  nom.required = true;
  const description = element('textarea');
  description.rows = 3;
  const couleur = element('input');
  couleur.type = 'text';
  couleur.placeholder = '#ffcc00';
  couleur.setAttribute('autocomplete', 'off');
  const selecteur = element('input');
  selecteur.type = 'color';
  selecteur.setAttribute('aria-label', t('admin.cat.couleur_choisir'));
  selecteur.value = '#ffcc00';
  const ligneCouleur = element('div', 'formulaire-ligne');
  ligneCouleur.append(champ(t('admin.cat.couleur'), couleur), selecteur);
  const contraste = element('p', 'carte-meta');
  contraste.setAttribute('role', 'status');
  const dossier = element('p', 'carte-meta');
  const pochette = creerChampPochette();

  const maj = (): void => {
    const valeur = couleur.value.trim();
    const ratio = valeur === '' ? undefined : ratioCouleur(valeur);
    if (ratio === undefined) {
      contraste.textContent = '';
    } else {
      const ok = ratio >= SEUILS.composant;
      contraste.textContent = `${ok ? '✓' : '⚠'} ${tv('admin.cat.contraste', { ratio: ratio.toFixed(1) })}`;
    }
    if (/^#[0-9a-fA-F]{6}$/.test(valeur)) selecteur.value = valeur.toLowerCase();
    dossier.textContent =
      categorie === undefined
        ? tv('admin.cat.dossier', { dossier: slugifier(nom.value) || '…' })
        : tv('admin.cat.dossier', { dossier: categorie.dossier });
  };
  couleur.addEventListener('input', maj);
  nom.addEventListener('input', maj);
  selecteur.addEventListener('input', () => {
    couleur.value = selecteur.value;
    maj();
    modifications.marquer();
  });

  if (categorie !== undefined) {
    const v = formulaireDepuisCategorie(categorie, fiche);
    nom.value = v.nom;
    description.value = v.description;
    couleur.value = v.couleur;
  }
  maj();

  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = creerProgression();
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.cat.enregistrer'));
  enregistrer.type = 'submit';
  const annuler = element('button', 'bouton', t('admin.edition.annuler'));
  annuler.type = 'button';
  annuler.addEventListener('click', () => {
    modifications.oublier();
    termine();
  });
  const actions = element('div', 'admin-actions');
  actions.append(enregistrer, annuler);

  const notes = element(
    'p',
    'carte-meta',
    categorie === undefined ? t('admin.cat.note_creation') : t('admin.cat.note_nom'),
  );
  const pochetteActuelle =
    categorie === undefined
      ? undefined
      : categorie.images.find((i) => /\/(cover|pochette)\.[a-z]+$/i.test(i.chemin));
  const actuelle = element('img', 'admin-apercu');
  actuelle.alt = '';
  actuelle.hidden = pochetteActuelle === undefined;
  if (pochetteActuelle !== undefined) actuelle.src = adresseBrute(pochetteActuelle.chemin);

  f.append(
    champ(t('admin.cat.nom'), nom),
    dossier,
    notes,
    champ(t('admin.cat.description'), description),
    ligneCouleur,
    contraste,
    ...pochette.elements,
    actuelle,
    actions,
    progression.element,
    erreurs,
  );

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;
    void enregistrerLaCategorie();
  });

  async function enregistrerLaCategorie(): Promise<void> {
    erreurs.textContent = '';
    for (const c of [nom, couleur]) c.removeAttribute('aria-invalid');
    envoiEnCours = true;
    enregistrer.disabled = true;
    try {
      const saisi: FormulaireCategorie = {
        nom: nom.value,
        description: description.value,
        couleur: couleur.value,
      };
      const nouvelle = pochette.pochette();
      const image =
        nouvelle === undefined
          ? undefined
          : {
              octets: new Uint8Array(await nouvelle.blob.arrayBuffer()),
              extension: nouvelle.extension,
            };
      const plan =
        categorie === undefined
          ? planCreationCategorie({ formulaire: saisi, ...(image && { pochette: image }), depot })
          : planModificationCategorie({
              categorie,
              fiche,
              formulaire: saisi,
              ...(image && { pochette: image }),
            });
      if (!plan.ok) {
        for (const e of plan.erreurs) {
          if (e.champ === 'nom' || e.champ === 'reserve' || e.champ === 'doublon') {
            nom.setAttribute('aria-invalid', 'true');
          } else if (e.champ === 'couleur' || e.champ === 'contraste') {
            couleur.setAttribute('aria-invalid', 'true');
          }
        }
        erreurs.replaceChildren(
          ...plan.erreurs.map((e) => element('p', undefined, libelleErreurCategorie(e))),
        );
        const premier = plan.erreurs[0]?.champ;
        (premier === 'couleur' || premier === 'contraste' ? couleur : nom).focus();
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
      const succes = categorie === undefined ? t('admin.cat.ok_creee') : t('admin.edition.ok');
      annoncer(succes);
      termine(succes);
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
