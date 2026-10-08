// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Album } from '../catalogue/schemas';
import { urlDuFichier } from '../catalogue/charger';
import type { Lecteur } from './lecteur';

const DECALAGE_PAR_DEFAUT = 10;

/** Branche le lecteur sur la Media Session API (touches multimédia, écran de verrouillage). */
export function brancherMediaSession(
  lecteur: Lecteur,
  chercherAlbum: (id: string) => Album | undefined,
): void {
  if (!('mediaSession' in navigator)) return;
  const session = navigator.mediaSession;

  const actions: [MediaSessionAction, MediaSessionActionHandler][] = [
    ['play', () => lecteur.lire()],
    ['pause', () => lecteur.pause()],
    ['previoustrack', () => lecteur.precedent()],
    ['nexttrack', () => lecteur.suivant()],
    ['seekbackward', (d) => lecteur.sauter(-(d.seekOffset ?? DECALAGE_PAR_DEFAUT))],
    ['seekforward', (d) => lecteur.sauter(d.seekOffset ?? DECALAGE_PAR_DEFAUT)],
    [
      'seekto',
      (d) => {
        if (d.seekTime !== undefined) lecteur.aller(d.seekTime);
      },
    ],
  ];
  for (const [action, gestionnaire] of actions) {
    try {
      session.setActionHandler(action, gestionnaire);
    } catch {
      // Action non prise en charge par ce navigateur.
    }
  }

  lecteur.addEventListener('piste', () => {
    const { piste } = lecteur.etat();
    if (piste === undefined) {
      session.metadata = null;
      return;
    }
    const album = piste.album !== undefined ? chercherAlbum(piste.album)?.titre : undefined;
    session.metadata = new MediaMetadata({
      title: piste.titre,
      artist: piste.artiste,
      album: album ?? '',
      artwork:
        piste.pochette !== undefined
          ? [{ src: new URL(urlDuFichier(piste.pochette), window.location.href).href }]
          : [],
    });
  });

  lecteur.addEventListener('etat', () => {
    const etat = lecteur.etat();
    session.playbackState =
      etat.piste === undefined ? 'none' : etat.enLecture ? 'playing' : 'paused';
    if (etat.piste === undefined || !(etat.duree > 0)) return;
    try {
      session.setPositionState({
        duration: etat.duree,
        position: Math.min(etat.position, etat.duree),
        playbackRate: 1,
      });
    } catch {
      // Valeurs transitoires invalides pendant un changement de piste.
    }
  });
}
