// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import type { Reglages } from '../site/reglages';
import { memeContenu } from './album';
import { champ, element } from './dom';
import type { Espace } from './espace';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import {
  CHEMIN_REGLAGES,
  DESCRIPTEURS,
  ecrireChemin,
  GROUPES,
  identifiantsConnus,
  lireChemin,
  reglagesDepuisFichier,
  serialiserReglages,
  validerReglages,
  type Descripteur,
} from './site-champs';
import { surveillerModifications } from './sortie';

/** Formulaire des réglages du site (`public/site.json`), généré à partir de la liste des champs. */
export function construireSite(espace: Espace, termine: (message: string) => void): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-site-titre');
  const titre = element('h2', undefined, t('admin.site.titre'));
  titre.id = 'admin-site-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  Promise.all([espace.depot(), espace.client.lire(CHEMIN_REGLAGES)])
    .then(([depot, fichier]) => {
      let brut: unknown;
      try {
        brut =
          fichier === undefined ? undefined : JSON.parse(new TextDecoder().decode(fichier.contenu));
      } catch {
        throw new Error('site.json illisible');
      }
      chargement.remove();
      racine.append(
        formulaire(espace, reglagesDepuisFichier(brut), brut, identifiantsConnus(depot), termine),
      );
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent =
        erreur instanceof Error && erreur.message === 'site.json illisible'
          ? t('admin.erreur.fiche')
          : messageErreur(erreur);
    });
  return racine;
}

interface Controle {
  /** Lit la valeur courante du champ. */
  lire(): unknown;
  /** Élément qui reçoit le focus et `aria-invalid` en cas d'erreur. */
  focus: HTMLElement;
}

function formulaire(
  espace: Espace,
  initial: Reglages,
  brutInitial: unknown,
  idsConnus: ReadonlySet<string>,
  termine: (message: string) => void,
): HTMLFormElement {
  const f = element('form', 'admin-formulaire admin-site');
  f.noValidate = true;
  const modifications = surveillerModifications(f);
  const controles = new Map<string, Controle>();
  let envoiEnCours = false;

  for (const groupe of GROUPES) {
    const ensemble = element('fieldset', 'admin-champs');
    ensemble.append(element('legend', undefined, t(groupe.titre)));
    for (const descripteur of groupe.champs) {
      const { elements, controle } = creerChamp(
        descripteur,
        lireChemin(initial, descripteur.chemin),
        modifications.marquer,
      );
      controles.set(descripteur.chemin, controle);
      ensemble.append(...elements);
    }
    f.append(ensemble);
  }

  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const avertissements = element('p', 'carte-meta');
  avertissements.setAttribute('role', 'status');
  const progression = creerProgression();
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.site.enregistrer'));
  enregistrer.type = 'submit';
  f.append(enregistrer, progression.element, avertissements, erreurs);

  /** Réglages d'après les champs du formulaire. */
  const collecter = (): Reglages => {
    let courant: Reglages = initial;
    for (const [chemin, controle] of controles)
      courant = ecrireChemin(courant, chemin, controle.lire());
    return courant;
  };

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;
    void enregistrerLesReglages();
  });

  async function enregistrerLesReglages(): Promise<void> {
    erreurs.textContent = '';
    avertissements.textContent = '';
    for (const c of controles.values()) c.focus.removeAttribute('aria-invalid');
    const resultat = validerReglages(collecter());
    if (!resultat.ok) {
      const lignes: HTMLElement[] = [];
      let premier: HTMLElement | undefined;
      for (const probleme of resultat.problemes) {
        const descripteur = DESCRIPTEURS.find(
          (d) => probleme.chemin === d.chemin || probleme.chemin.startsWith(`${d.chemin}.`),
        );
        const champ_ = descripteur === undefined ? undefined : controles.get(descripteur.chemin);
        champ_?.focus.setAttribute('aria-invalid', 'true');
        premier ??= champ_?.focus;
        lignes.push(
          element(
            'p',
            undefined,
            tv('admin.site.err_champ', {
              champ: descripteur === undefined ? probleme.chemin : t(descripteur.libelle),
            }),
          ),
        );
      }
      erreurs.replaceChildren(...lignes);
      premier?.focus();
      return;
    }
    const contenu = serialiserReglages(resultat.reglages);
    // Même contenu que le fichier du dépôt (mise en forme et ordre des clés mis à part) : rien à publier.
    if (memeContenu(brutInitial, resultat.reglages)) {
      erreurs.replaceChildren(element('p', undefined, t('admin.edition.rien')));
      return;
    }
    envoiEnCours = true;
    enregistrer.disabled = true;
    progression.demarrer();
    try {
      await espace.client.commit('modification: réglages du site', [
        { chemin: CHEMIN_REGLAGES, contenu },
      ]);
      modifications.oublier();
      espace.invalider();
      const inconnus = resultat.reglages.accueil.misesEnAvant.filter((id) => !idsConnus.has(id));
      const succes = [
        t('admin.site.ok'),
        inconnus.length > 0 ? tv('admin.site.mise_inconnue', { ids: inconnus.join(', ') }) : '',
      ]
        .filter((m) => m !== '')
        .join(' ');
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

/** Construit les éléments d'un champ d'après son descripteur et la valeur initiale. */
function creerChamp(
  d: Descripteur,
  valeur: unknown,
  modifie: () => void,
): { elements: HTMLElement[]; controle: Controle } {
  switch (d.type) {
    case 'texte': {
      const saisie = d.long === true ? element('textarea') : element('input');
      if (saisie instanceof HTMLInputElement) saisie.type = 'text';
      else saisie.rows = 3;
      saisie.value = typeof valeur === 'string' ? valeur : '';
      return {
        elements: [champ(t(d.libelle), saisie)],
        controle: { lire: () => saisie.value, focus: saisie },
      };
    }
    case 'case': {
      const saisie = element('input');
      saisie.type = 'checkbox';
      saisie.checked = valeur === true;
      const etiquette = element('label', 'champ-case');
      etiquette.append(saisie, element('span', undefined, t(d.libelle)));
      return { elements: [etiquette], controle: { lire: () => saisie.checked, focus: saisie } };
    }
    case 'curseur': {
      const saisie = element('input');
      saisie.type = 'range';
      saisie.min = String(d.min);
      saisie.max = String(d.max);
      saisie.step = String(d.pas);
      saisie.value = String(typeof valeur === 'number' ? valeur : d.max);
      const sortie = element('output', 'carte-meta', saisie.value);
      saisie.addEventListener('input', () => {
        sortie.textContent = saisie.value;
      });
      const etiquette = champ(t(d.libelle), saisie);
      etiquette.append(sortie);
      return {
        elements: [etiquette],
        controle: { lire: () => Number(saisie.value), focus: saisie },
      };
    }
    case 'lignes': {
      const saisie = element('textarea');
      saisie.rows = 4;
      saisie.spellcheck = false;
      saisie.value = Array.isArray(valeur)
        ? valeur.filter((v) => typeof v === 'string').join('\n')
        : '';
      return {
        elements: [champ(t(d.libelle), saisie)],
        controle: {
          lire: () =>
            saisie.value
              .split('\n')
              .map((l) => l.trim())
              .filter((l) => l !== ''),
          focus: saisie,
        },
      };
    }
    case 'cases': {
      const ensemble = element('fieldset', 'admin-champs');
      ensemble.append(element('legend', undefined, t(d.libelle)));
      const actuelles = Array.isArray(valeur) ? valeur : [];
      const boites = d.choix.map((choix) => {
        const saisie = element('input');
        saisie.type = 'checkbox';
        saisie.value = choix.valeur;
        saisie.checked = actuelles.includes(choix.valeur);
        const etiquette = element('label', 'champ-case');
        etiquette.append(saisie, element('span', undefined, t(choix.libelle)));
        ensemble.append(etiquette);
        return saisie;
      });
      return {
        elements: [ensemble],
        controle: {
          lire: () => boites.filter((b) => b.checked).map((b) => b.value),
          focus: boites[0] ?? ensemble,
        },
      };
    }
    case 'liens': {
      const ensemble = element('fieldset', 'admin-champs');
      ensemble.append(element('legend', undefined, t(d.libelle)));
      const liste = element('ul', 'admin-liste');
      const lignes: { nom: HTMLInputElement; url: HTMLInputElement }[] = [];
      const ajouter = element('button', 'bouton', t('admin.site.ajouter_lien'));
      ajouter.type = 'button';

      const ajouterLigne = (nom: string, url: string, focus = false): void => {
        const item = element('li', 'admin-ligne');
        const champNom = element('input');
        champNom.type = 'text';
        champNom.value = nom;
        const champUrl = element('input');
        champUrl.type = 'text';
        champUrl.value = url;
        champUrl.placeholder = 'https://';
        const retirer = element('button', 'bouton', '✕');
        retirer.type = 'button';
        retirer.setAttribute('aria-label', tv('admin.site.retirer_lien', { nom: nom || '…' }));
        const ligne = { nom: champNom, url: champUrl };
        lignes.push(ligne);
        retirer.addEventListener('click', () => {
          lignes.splice(lignes.indexOf(ligne), 1);
          item.remove();
          modifie();
          ajouter.focus();
        });
        item.append(
          champ(t('admin.site.lien_nom'), champNom),
          champ(t('admin.site.lien_url'), champUrl),
          retirer,
        );
        liste.append(item);
        if (focus) champNom.focus();
      };
      for (const lien of Array.isArray(valeur) ? valeur : []) {
        const l = lien as { nom?: unknown; url?: unknown };
        ajouterLigne(
          typeof l.nom === 'string' ? l.nom : '',
          typeof l.url === 'string' ? l.url : '',
        );
      }
      ajouter.addEventListener('click', () => {
        ajouterLigne('', '', true);
        modifie();
      });
      ensemble.append(liste, ajouter);
      return {
        elements: [ensemble],
        controle: {
          // Une ligne laissée entièrement vide est ignorée.
          lire: () =>
            lignes
              .map((l) => ({ nom: l.nom.value.trim(), url: l.url.value.trim() }))
              .filter((l) => l.nom !== '' || l.url !== ''),
          get focus() {
            return lignes[0]?.nom ?? ajouter;
          },
        },
      };
    }
  }
}
