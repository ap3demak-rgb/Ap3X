// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Donnees } from '../catalogue/donnees';
import { fileDeLecture, trierAlbums, trierPistes, type CleTri } from '../catalogue/navigation';
import type { Album, Piste } from '../catalogue/schemas';
import { favoris, favorisAlbums } from '../favoris';
import { obtenirLangue, t } from '../i18n';
import { compteAlbums, comptePistes } from '../i18n/format';
import { lecteur } from '../lecteur';
import { carteAlbum, cartePiste, grille } from '../ui/cartes';
import { selecteurTri } from '../ui/tri';
import { sousTitre, titrePage } from './commun';

/** Tri conservé entre deux affichages (changement de langue, navigation). */
export const etatTri: { valeur: CleTri } = { valeur: 'recent' };

export interface OptionsCollection {
  donnees: Donnees;
  titre: string;
  description?: string;
  /** Albums de la collection (section « Albums »). */
  albums: readonly Album[];
  /** Pistes de la section « Titres » (pistes hors album, ou toutes pour un hashtag ou les favoris). */
  pistes: readonly Piste[];
  /** File lancée par « Tout lire » ; par défaut, les albums puis les pistes hors album, dans l'ordre affiché. */
  file?: (albums: readonly Album[], pistes: readonly Piste[]) => Piste[];
  messageVide: string;
  /** Page des favoris : se met à jour quand un favori est retiré. */
  suivreFavoris?: () => { albums: readonly Album[]; pistes: readonly Piste[] };
}

/** Éléments d'une page de collection : titre, commandes, albums puis titres. */
export function collection(options: OptionsCollection): HTMLElement[] {
  const { donnees, titre, description, messageVide } = options;
  let albums = options.albums;
  let pistes = options.pistes;
  const langue = obtenirLangue();

  const entete = document.createElement('header');
  entete.className = 'entete-collection';
  const compte = document.createElement('p');
  compte.className = 'carte-meta';
  entete.append(titrePage(titre));
  if (description !== undefined && description !== '') {
    const texte = document.createElement('p');
    texte.textContent = description;
    entete.append(texte);
  }
  entete.append(compte);

  const commandes = document.createElement('div');
  commandes.className = 'filtres';
  const toutLire = document.createElement('button');
  toutLire.type = 'button';
  toutLire.className = 'bouton bouton-principal';
  toutLire.textContent = t('lecteur.lire_tout');
  toutLire.setAttribute('aria-label', `${t('lecteur.lire_tout')} : ${titre}`);

  const zone = document.createElement('div');
  zone.tabIndex = -1;
  zone.className = 'zone-collection';

  const triees = (): { albums: Album[]; pistes: Piste[] } => ({
    albums: trierAlbums(albums, etatTri.valeur, langue),
    pistes: trierPistes(pistes, etatTri.valeur, langue),
  });

  const rafraichir = (): void => {
    const { albums: albumsTries, pistes: pistesTriees } = triees();
    const total = options.file
      ? options.file(albumsTries, pistesTriees)
      : fileDeLecture(donnees, albumsTries, pistesTriees);
    compte.textContent =
      albumsTries.length > 0
        ? `${comptePistes(total.length)} · ${compteAlbums(albumsTries.length)}`
        : comptePistes(total.length);
    toutLire.disabled = total.length === 0;
    zone.replaceChildren();
    if (albumsTries.length === 0 && pistesTriees.length === 0) {
      const vide = document.createElement('p');
      vide.textContent = messageVide;
      zone.append(vide);
      return;
    }
    if (albumsTries.length > 0) {
      const section = document.createElement('section');
      section.append(
        sousTitre(t('nav.albums')),
        grille(albumsTries.map((album) => carteAlbum(donnees, album))),
      );
      zone.append(section);
    }
    if (pistesTriees.length > 0) {
      const section = document.createElement('section');
      section.append(
        sousTitre(t('categorie.titres')),
        grille(pistesTriees.map((piste) => cartePiste(donnees, piste, pistesTriees))),
      );
      zone.append(section);
    }
  };

  toutLire.addEventListener('click', () => {
    const { albums: albumsTries, pistes: pistesTriees } = triees();
    const file = options.file
      ? options.file(albumsTries, pistesTriees)
      : fileDeLecture(donnees, albumsTries, pistesTriees);
    lecteur.charger(file, 0);
  });

  commandes.append(
    toutLire,
    selecteurTri(['recent', 'ancien', 'titre', 'duree', 'artiste'], etatTri.valeur, (tri) => {
      etatTri.valeur = tri;
      rafraichir();
    }),
  );

  if (options.suivreFavoris !== undefined) {
    const actualiser = (): void => {
      if (!zone.isConnected) {
        favoris.removeEventListener('change', actualiser);
        favorisAlbums.removeEventListener('change', actualiser);
        return;
      }
      const suite = options.suivreFavoris?.();
      if (suite === undefined) return;
      albums = suite.albums;
      pistes = suite.pistes;
      rafraichir();
      // La carte retirée disparaît avec le focus : on le replace sur la zone de contenu.
      zone.focus({ preventScroll: true });
    };
    favoris.addEventListener('change', actualiser);
    favorisAlbums.addEventListener('change', actualiser);
  }

  rafraichir();
  return [entete, commandes, zone];
}
