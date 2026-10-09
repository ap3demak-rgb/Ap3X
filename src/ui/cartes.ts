// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { urlDuFichier } from '../catalogue/charger';
import type { Donnees } from '../catalogue/donnees';
import { pistesDeAlbum } from '../catalogue/donnees';
import { pochetteReduite } from '../catalogue/pochettes';
import type { Album, Piste } from '../catalogue/schemas';
import { favoris, favorisAlbums, type Favoris } from '../favoris';
import { t, tv } from '../i18n';
import { comptePistes, formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { icone } from '../lecteur/icones';
import { fenetre3d } from '../rendu3d';
import { lienAlbum, lienArtiste, lienPiste, lienTag } from '../routeur';
import { annoncer } from './annonceur';
import { choisirPlaylist } from './dialogue';

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

/**
 * Grande pochette qui passe en 3D quand le rendu 3D est disponible. L'image plane reste l'alternative
 * (WebGL absent, mouvement réduit, erreur) ; le canvas 3D est décoratif.
 */
export function pochette3d(chemin: string | undefined, classe = 'pochette-grande'): HTMLElement {
  if (chemin === undefined) return pochette(undefined, classe);
  const conteneur = document.createElement('div');
  conteneur.className = `pochette-3d ${classe}`.trim();
  const image = pochette(chemin);
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  canvas.hidden = true;
  conteneur.append(image, canvas);
  fenetre3d(
    { canvas, type: 'pochette', url: urlDuFichier(chemin) },
    () => {
      image.hidden = true;
      canvas.hidden = false;
    },
    () => {
      image.hidden = false;
      canvas.hidden = true;
    },
  );
  return conteneur;
}

export function lien(href: string, texte: string, classe = ''): HTMLAnchorElement {
  const a = document.createElement('a');
  a.href = href;
  a.textContent = texte;
  if (classe !== '') a.className = classe;
  return a;
}

/** Lien vers la page d'un artiste. */
export function lienDeLArtiste(nom: string): HTMLAnchorElement {
  return lien(lienArtiste(nom), nom);
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

/** Liste de hashtags cliquables (page du hashtag). `max` limite le nombre affiché. */
export function chipsHashtags(hashtags: readonly string[], max?: number): HTMLElement | undefined {
  const affiches = max === undefined ? hashtags : hashtags.slice(0, max);
  if (affiches.length === 0) return undefined;
  const liste = document.createElement('ul');
  liste.className = 'chips';
  liste.setAttribute('aria-label', t('piste.hashtags'));
  for (const hashtag of affiches) {
    const element = document.createElement('li');
    element.append(lien(lienTag(hashtag), `#${hashtag}`));
    liste.append(element);
  }
  return liste;
}

/**
 * Bouton « J'aime » (cœur) d'un élément d'un magasin de favoris. L'état est indiqué par la forme du
 * cœur (contour ou plein) et par le libellé (Ajouter / Retirer des favoris), jamais par la couleur seule.
 */
export function boutonCoeur(magasin: Favoris, id: string, titre: string): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bouton-icone bouton-jaime';
  let insere = false;
  const actualiser = (): void => {
    // Le bouton se détache lui-même du magasin une fois retiré de la page.
    if (insere && !b.isConnected) {
      magasin.removeEventListener('change', actualiser);
      return;
    }
    if (b.isConnected) insere = true;
    const aime = magasin.estFavori(id);
    b.replaceChildren(icone(aime ? 'coeurPlein' : 'coeur'));
    b.setAttribute('aria-label', `${t(aime ? 'jaime.retirer' : 'jaime.ajouter')} : ${titre}`);
    b.classList.toggle('actif', aime);
  };
  b.addEventListener('click', () => {
    magasin.basculer(id);
  });
  magasin.addEventListener('change', actualiser);
  actualiser();
  return b;
}

export const boutonJaime = (piste: Piste): HTMLButtonElement =>
  boutonCoeur(favoris, piste.id, piste.titre);

export const boutonJaimeAlbum = (album: Album): HTMLButtonElement =>
  boutonCoeur(favorisAlbums, album.id, album.titre);

/** Bouton « Ajouter à une playlist » : ouvre la boîte de choix avec les pistes données. */
export function boutonPlaylist(titre: string, pistes: () => readonly string[]): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'bouton-icone';
  b.append(icone('playlistAjout'));
  b.setAttribute('aria-label', `${t('playlist.ajouter')} : ${titre}`);
  b.addEventListener('click', () => choisirPlaylist(titre, pistes()));
  return b;
}

/** Bouton texte « Ajouter à la file » pour une ou plusieurs pistes ; annonce l'ajout. */
export function boutonFile(titre: string, pistes: () => readonly Piste[]): HTMLButtonElement {
  return bouton(t('lecteur.ajouter'), `${t('lecteur.ajouter')} : ${titre}`, () => {
    lecteur.ajouterPlusieurs(pistes());
    annoncer(tv('lecteur.ajoutee', { titre }));
  });
}

/** Carte d'une piste : pochette, titre, artiste, catégorie, durée, lecture et ajout à la file. */
export function cartePiste(
  donnees: Donnees,
  piste: Piste,
  contexte: readonly Piste[],
  niveauTitre: 'h2' | 'h3' = 'h3',
): HTMLElement {
  const carte = document.createElement('article');
  carte.className = 'carte';
  const description = `${piste.titre} – ${piste.artiste}`;

  const lienPochette = lien(lienPiste(piste.id), '');
  lienPochette.tabIndex = -1;
  lienPochette.setAttribute('aria-hidden', 'true');
  lienPochette.append(pochette(pochetteReduite(piste)));

  const corps = document.createElement('div');
  corps.className = 'carte-corps';
  const titre = document.createElement(niveauTitre);
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
    boutonFile(piste.titre, () => [piste]),
    boutonJaime(piste),
    boutonPlaylist(piste.titre, () => [piste.id]),
  );
  const chips = chipsHashtags(piste.hashtags, 3);
  corps.append(
    titre,
    ligneMeta(piste.artiste, categorie, formaterDuree(piste.duree)),
    ...(chips !== undefined ? [chips] : []),
    actions,
  );

  carte.append(lienPochette, corps);
  return carte;
}

/** Carte d'un album : pochette, titre, artiste, année, badge de type, nombre de pistes, durée. */
export function carteAlbum(
  donnees: Donnees,
  album: Album,
  niveauTitre: 'h2' | 'h3' = 'h3',
): HTMLElement {
  const carte = document.createElement('article');
  carte.className = 'carte';

  const lienPochette = lien(lienAlbum(album.id), '');
  lienPochette.tabIndex = -1;
  lienPochette.setAttribute('aria-hidden', 'true');
  lienPochette.append(pochette(pochetteReduite(album)));

  const corps = document.createElement('div');
  corps.className = 'carte-corps';
  const titre = document.createElement(niveauTitre);
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
    boutonFile(album.titre, () => pistesDeAlbum(donnees, album)),
    boutonJaimeAlbum(album),
    boutonPlaylist(album.titre, () => album.pistes),
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
