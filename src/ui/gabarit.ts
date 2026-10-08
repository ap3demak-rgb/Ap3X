// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { EMAIL_CONTACT } from '../constantes';
import { LANGUES, definirLangue, obtenirLangue, t, type Langue } from '../i18n';

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
  liste.addEventListener('change', () => definirLangue(liste.value as Langue));
  etiquette.append(texte, liste);
  return etiquette;
}

function lien(href: string, libelle: string): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = libelle;
  return a;
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
  navigation.append(
    lien('#/', t('nav.accueil')),
    lien('#/albums', t('nav.albums')),
    lien('#/licences', t('nav.licences')),
  );

  en.append(marque, navigation, selecteurLangue());
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
  return bas;
}
