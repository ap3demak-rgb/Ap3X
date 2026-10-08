// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { urlDuFichier } from '../catalogue/charger';
import type { Donnees } from '../catalogue/donnees';
import { pistesDeAlbum } from '../catalogue/donnees';
import type { Album, Piste } from '../catalogue/schemas';
import { t } from '../i18n';
import { comptePistes, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { icone } from '../lecteur/icones';
import { lienAlbum, lienPiste } from '../routeur';

/** Pochette (lazy) ou, à défaut, un cadre neutre avec une icône. Toujours décorative. */
export function pochette(chemin: string | undefined, classe = ''): HTMLElement {
  if (chemin === undefined) {
    const vide = document.createElement('div');
    vide.className = `pochette pochette-vide ${classe}`.trim();
    vide.setAttribute('aria-hidden', 'true');
    vide.append(icone('note'));
    return vide;
  }
  const image = document.createElement('img');
  image.className = `pochette ${classe}`.trim();
  image.src = urlDuFichier(chemin);
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  return image;
}

export function lien(href: string, texte: string, classe = ''): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = texte;
  if (classe !== '') a.className = classe;
  return a;
}

function bouton(libelle: string, aria: string, surClic: () => void): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bouton';
  b.textContent = libelle;
  b.setAttribute('aria-label', aria);
  b.addEventListener('click', surClic);
  return b;
}

function ligneMeta(...morceaux: string[]): HTMLElement {
  const p = document.createElement('p');
  p.className = 'carte-meta';
  p.textContent = morceaux.filter((m) => m !== '').join(' · ');
  return p;
}

/** Carte d'une piste : pochette, titre, artiste, catégorie, durée, lecture et ajout à la file. */
export function cartePiste(
  donnees: Donnees,
  piste: Piste,
  contexte: readonly Piste[],
): HTMLElement {
  const carte = document.createElement('article');
  carte.className = 'carte';
  const description = `${piste.titre} – ${piste.artiste}`;

  const lienPochette = lien(lienPiste(piste.id), '');
  lienPochette.tabIndex = -1;
  lienPochette.setAttribute('aria-hidden', 'true');
  lienPochette.append(pochette(piste.pochette));

  const corps = document.createElement('div');
  corps.className = 'carte-corps';
  const titre = document.createElement('h3');
  titre.className = 'carte-titre';
  titre.append(lien(lienPiste(piste.id), piste.titre));
  const categorie = donnees.categories.get(piste.categorie)?.nom ?? piste.categorie;
  const actions = document.createElement('div');
  actions.className = 'carte-actions';
  const index = Math.max(0, contexte.indexOf(piste));
  actions.append(
    bouton(t('lecteur.lecture'), `${t('lecteur.lecture')} : ${description}`, () =>
      lecteur.charger(contexte, index),
    ),
    bouton(t('lecteur.ajouter'), `${t('lecteur.ajouter')} : ${description}`, () =>
      lecteur.ajouter(piste),
    ),
  );
  corps.append(titre, ligneMeta(piste.artiste, categorie, formaterDuree(piste.duree)), actions);

  carte.append(lienPochette, corps);
  return carte;
}

/** Carte d'un album : pochette, titre, artiste, année, badge de type, nombre de pistes, durée. */
export function carteAlbum(donnees: Donnees, album: Album): HTMLElement {
  const carte = document.createElement('article');
  carte.className = 'carte';

  const lienPochette = lien(lienAlbum(album.id), '');
  lienPochette.tabIndex = -1;
  lienPochette.setAttribute('aria-hidden', 'true');
  lienPochette.append(pochette(album.pochette));

  const corps = document.createElement('div');
  corps.className = 'carte-corps';
  const titre = document.createElement('h3');
  titre.className = 'carte-titre';
  titre.append(lien(lienAlbum(album.id), album.titre));

  const badge = document.createElement('span');
  badge.className = 'badge';
  badge.textContent = t(`type.${album.type}`);

  const annee = album.date?.slice(0, 4) ?? '';
  const meta = ligneMeta(
    album.artiste,
    annee,
    comptePistes(album.nombrePistes),
    formaterDuree(album.duree),
  );

  const actions = document.createElement('div');
  actions.className = 'carte-actions';
  actions.append(
    bouton(t('album.lire'), `${t('album.lire')} : ${album.titre}`, () =>
      lecteur.charger(pistesDeAlbum(donnees, album), 0),
    ),
  );
  corps.append(titre, badge, meta, actions);

  carte.append(lienPochette, corps);
  return carte;
}

/** Grille de cartes. */
export function grille(cartes: HTMLElement[]): HTMLElement {
  const g = document.createElement('div');
  g.className = 'grille';
  g.append(...cartes);
  return g;
}
