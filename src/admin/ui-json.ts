// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import { champ, element } from './dom';
import type { Espace } from './espace';
import { fichiersJsonEditables, validerFichierJson, type FichierJson } from './json';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { surveillerModifications } from './sortie';

/**
 * Éditeur JSON avancé : modifie n'importe quel fichier de configuration du dépôt (réglages, manifeste,
 * catégories, albums, fiches de pistes). Le texte est validé avec les schémas du build avant l'envoi.
 */
export function construireJson(espace: Espace, termine: (message: string) => void): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-json-titre');
  const titre = element('h2', undefined, t('admin.json.titre'));
  titre.id = 'admin-json-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  espace
    .depot()
    .then((depot) => {
      chargement.remove();
      racine.append(...editeur(espace, fichiersJsonEditables(depot), termine));
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
    });
  return racine;
}

function editeur(
  espace: Espace,
  fichiers: FichierJson[],
  termine: (message: string) => void,
): HTMLElement[] {
  const avertissement = element('p', 'carte-meta', t('admin.json.avertissement'));
  const selection = element('select');
  selection.append(new Option('', ''));
  for (const fichier of fichiers) selection.append(new Option(fichier.chemin, fichier.chemin));

  const zone = element('textarea', 'admin-json');
  zone.rows = 18;
  zone.spellcheck = false;
  zone.setAttribute('wrap', 'off');
  zone.setAttribute('aria-label', t('admin.json.contenu'));
  zone.disabled = true;
  const etat = element('p', 'carte-meta');
  etat.setAttribute('role', 'status');
  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = creerProgression();
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.json.enregistrer'));
  enregistrer.type = 'button';
  enregistrer.disabled = true;

  let courant: FichierJson | undefined;
  let original = '';
  let envoiEnCours = false;
  const conteneur = element('div', 'admin-formulaire');
  const modifications = surveillerModifications(conteneur);

  /** Valide le texte saisi et met à jour l'état et le bouton d'enregistrement. */
  const verifier = (): void => {
    if (courant === undefined) return;
    const resultat = validerFichierJson(courant.type, zone.value);
    const change = zone.value !== original;
    if (resultat.ok) {
      etat.textContent = t('admin.json.valide');
      zone.removeAttribute('aria-invalid');
    } else {
      etat.textContent = tv('admin.json.invalide', { detail: resultat.detail });
      zone.setAttribute('aria-invalid', 'true');
    }
    enregistrer.disabled = !resultat.ok || !change || envoiEnCours;
  };
  zone.addEventListener('input', verifier);

  selection.addEventListener('change', () => {
    erreurs.textContent = '';
    courant = fichiers.find((f) => f.chemin === selection.value);
    zone.disabled = courant === undefined;
    enregistrer.disabled = true;
    etat.textContent = '';
    zone.value = '';
    original = '';
    modifications.oublier();
    if (courant === undefined) return;
    const fichier = courant;
    zone.value = t('admin.liste.chargement');
    espace.client
      .lireBlob(fichier.sha)
      .then((octets) => {
        if (courant !== fichier) return;
        original = new TextDecoder().decode(octets);
        zone.value = original;
        verifier();
      })
      .catch((erreur: unknown) => {
        zone.value = '';
        erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
      });
  });

  enregistrer.addEventListener('click', () => {
    if (courant === undefined || envoiEnCours) return;
    const fichier = courant;
    const contenu = zone.value.endsWith('\n') ? zone.value : `${zone.value}\n`;
    envoiEnCours = true;
    enregistrer.disabled = true;
    erreurs.textContent = '';
    progression.demarrer();
    espace.client
      .commit(`modification: ${fichier.chemin}`, [{ chemin: fichier.chemin, contenu }])
      .then(() => {
        modifications.oublier();
        espace.invalider();
        const succes = t('admin.json.ok');
        annoncer(succes);
        termine(succes);
      })
      .catch((erreur: unknown) => {
        progression.terminer();
        erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
      })
      .finally(() => {
        envoiEnCours = false;
        verifier();
      });
  });

  conteneur.append(
    champ(t('admin.json.fichier'), selection),
    zone,
    enregistrer,
    progression.element,
    etat,
    erreurs,
  );
  return [avertissement, conteneur];
}
