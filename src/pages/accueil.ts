// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { chargerCatalogue } from '../catalogue/charger';
import type { Piste } from '../catalogue/schemas';
import { t } from '../i18n';
import { formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';

function listeDesTitres(pistes: Piste[]): HTMLElement {
  const bloc = document.createElement('section');
  const titre = document.createElement('h2');
  titre.textContent = t('accueil.titres');
  bloc.append(titre);

  if (pistes.length === 0) {
    const vide = document.createElement('p');
    vide.textContent = t('accueil.vide');
    bloc.append(vide);
    return bloc;
  }

  const toutLire = document.createElement('button');
  toutLire.type = 'button';
  toutLire.className = 'bouton';
  toutLire.textContent = t('lecteur.lire_tout');
  toutLire.addEventListener('click', () => lecteur.charger(pistes, 0));

  const liste = document.createElement('ol');
  liste.className = 'liste-titres';
  pistes.forEach((piste, index) => {
    const ligne = document.createElement('li');
    const description = `${piste.titre} – ${piste.artiste}`;

    const lire = document.createElement('button');
    lire.type = 'button';
    lire.className = 'bouton';
    lire.textContent = t('lecteur.lecture');
    lire.setAttribute('aria-label', `${t('lecteur.lecture')} : ${description}`);
    lire.addEventListener('click', () => lecteur.charger(pistes, index));

    const nom = document.createElement('span');
    nom.className = 'titre-nom';
    nom.textContent = description;
    const duree = document.createElement('span');
    duree.className = 'titre-duree';
    duree.textContent = formaterDuree(piste.duree);

    const ajouter = document.createElement('button');
    ajouter.type = 'button';
    ajouter.className = 'bouton';
    ajouter.textContent = t('lecteur.ajouter');
    ajouter.setAttribute('aria-label', `${t('lecteur.ajouter')} : ${description}`);
    ajouter.addEventListener('click', () => lecteur.ajouter(piste));

    ligne.append(lire, nom, duree, ajouter);
    liste.append(ligne);
  });
  bloc.append(toutLire, liste);
  return bloc;
}

export function pageAccueil(): HTMLElement {
  const section = document.createElement('section');
  const titre = document.createElement('h1');
  titre.textContent = t('site.nom');
  const intro = document.createElement('p');
  intro.textContent = t('accueil.intro');
  section.append(titre, intro);

  chargerCatalogue()
    .then((catalogue) => {
      section.append(listeDesTitres(catalogue.pistes));
    })
    .catch((erreur: unknown) => {
      console.error(erreur);
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = t('erreur.chargement');
      section.append(message);
    });
  return section;
}
