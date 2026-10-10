// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { chargerCatalogue } from '../catalogue/charger';
import { reglages, type EntreeMenu } from '../site/reglages';
import { CATEGORIE_FAVORIS, CATEGORIE_TOUT } from '../catalogue/navigation';
import { EMAIL_CONTACT } from '../constantes';
import { LANGUES, definirLangue, obtenirLangue, t, type Langue } from '../i18n';
import { lienCategorie, routeCourante } from '../routeur';
import { formulaireRecherche } from './recherche';

/** Noms des langues dans leur propre langue : volontairement non traduits. */
export const NOMS_LANGUES: Record<Langue, string> = {
  en: 'English',
  fr: 'Français',
  de: 'Deutsch',
  ja: '日本語',
  es: 'Español',
  ru: 'Русский',
  vi: 'Tiếng Việt',
  zh: '中文',
  ko: '한국어',
};

function selecteurLangue(): HTMLElement {
  const etiquette = document.createElement('label');
  const texte = document.createElement('span');
  texte.textContent = t('langue.libelle');
  const liste = document.createElement('select');
  for (const langue of LANGUES) {
    const option = document.createElement('option');
    option.value = langue;
    option.lang = langue;
    option.textContent = NOMS_LANGUES[langue];
    option.selected = langue === obtenirLangue();
    liste.append(option);
  }
  liste.addEventListener('change', () => {
    void definirLangue(liste.value as Langue);
  });
  etiquette.append(texte, liste);
  return etiquette;
}

function lien(href: string, libelle: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = libelle;
  return a;
}

/** Filtre par catégorie : liste déroulante qui ouvre la page de la catégorie choisie. */
function selecteurCategorie(): HTMLElement {
  const liste = document.createElement('select');
  liste.className = 'selecteur-categorie';
  liste.setAttribute('aria-label', t('categorie.filtre'));
  const route = routeCourante();
  const actuelle = route.nom === 'categorie' ? route.id : '';

  const ajouter = (valeur: string, texte: string): void => {
    const option = document.createElement('option');
    option.value = valeur;
    option.textContent = texte;
    option.selected = valeur === actuelle;
    liste.append(option);
  };
  ajouter('', t('categorie.filtre'));
  ajouter(CATEGORIE_TOUT, t('categorie.tout'));
  ajouter(CATEGORIE_FAVORIS, t('categorie.favoris'));

  // Les catégories du catalogue s'insèrent entre « Tout » et « Favoris » dès qu'il est chargé.
  chargerCatalogue()
    .then((catalogue) => {
      const favorisOption = [...liste.options].find((o) => o.value === CATEGORIE_FAVORIS);
      for (const categorie of catalogue.categories) {
        const option = document.createElement('option');
        option.value = categorie.slug;
        option.textContent = categorie.nom;
        option.selected = categorie.slug === actuelle;
        liste.insertBefore(option, favorisOption ?? null);
      }
    })
    .catch(() => undefined);

  liste.addEventListener('change', () => {
    if (liste.value !== '') window.location.hash = lienCategorie(liste.value);
  });
  return liste;
}

export function evitement(cible: HTMLElement): HTMLElement {
  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'evitement';
  bouton.textContent = t('nav.contenu');
  bouton.addEventListener('click', () => cible.focus());
  return bouton;
}

export function entete(): HTMLElement {
  const en = document.createElement('header');
  const marque = lien('#/', '');
  const logo = document.createElement('img');
  logo.src = `${import.meta.env.BASE_URL}icones/logo.svg`;
  logo.alt = '';
  logo.width = 40;
  logo.height = 40;
  const nom = document.createElement('span');
  nom.textContent = t('site.nom');
  marque.append(logo, nom);
  marque.className = 'marque';

  const navigation = document.createElement('nav');
  navigation.setAttribute('aria-label', t('nav.principale'));
  // Les entrées masquées par les réglages du site (`menu.masques`) ne sont pas affichées.
  const entrees: [EntreeMenu, string, string][] = [
    ['categories', '#/categories', t('nav.categories')],
    ['albums', '#/albums', t('nav.albums')],
    ['playlists', '#/playlists', t('nav.playlists')],
    ['favoris', lienCategorie(CATEGORIE_FAVORIS), t('nav.favoris')],
    ['licences', '#/licences', t('nav.licences')],
  ];
  navigation.append(
    lien('#/', t('nav.accueil')),
    ...entrees
      .filter(([nom]) => !reglages.menu.masques.includes(nom))
      .map(([, adresse, texte]) => lien(adresse, texte)),
    selecteurCategorie(),
  );

  en.append(marque, navigation, formulaireRecherche(), selecteurLangue());
  return en;
}

export function pied(): HTMLElement {
  const bas = document.createElement('footer');
  const copyright = document.createElement('p');
  copyright.textContent = t('site.copyright');
  const musique = document.createElement('p');
  musique.textContent = t('licence.musique');
  const code = document.createElement('p');
  code.textContent = t('licence.site');
  const contact = document.createElement('p');
  contact.append(lien(`mailto:${EMAIL_CONTACT}`, `${t('pied.contact')} : ${EMAIL_CONTACT}`));
  bas.append(copyright, musique, code, contact);
  if (reglages.liens.length > 0) {
    const autres = document.createElement('ul');
    autres.className = 'pied-liens';
    for (const { nom, url } of reglages.liens) {
      const item = document.createElement('li');
      const adresse = lien(url, nom);
      if (!url.startsWith('mailto:')) adresse.rel = 'noopener noreferrer';
      item.append(adresse);
      autres.append(item);
    }
    bas.append(autres);
  }
  return bas;
}
