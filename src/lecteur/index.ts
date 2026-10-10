// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { chargerCatalogue, urlDuFichier } from '../catalogue/charger';
import { reglages } from '../site/reglages';
import type { Album, Catalogue, Piste } from '../catalogue/schemas';
import { creerBarre, type Barre } from './barre';
import { Lecteur } from './lecteur';
import { brancherMediaSession } from './media-session';
import { installerRaccourcis } from './raccourcis';

function stockageLocal(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Élément audio unique de l'application (utilisé aussi par l'analyse sonore du rendu 3D). */
export const elementAudio = new Audio();

/** Lecteur unique de l'application : les pages y chargent leurs pistes (`lecteur.charger(...)`). */
export const lecteur = new Lecteur({
  audio: elementAudio,
  prechargeur: new Audio(),
  resoudreUrl: urlDuFichier,
  aleatoireParDefaut: reglages.options.aleatoire,
  economieDonnees: () => {
    const connexion = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection;
    return connexion?.saveData === true;
  },
  ...(stockageLocal() !== undefined && { stockage: stockageLocal() as Storage }),
});

let albums = new Map<string, Album>();
const chercherAlbum = (id: string): Album | undefined => albums.get(id);

/** Pistes de l'album d'une piste (dans l'ordre), ou la piste seule. */
function fileDepuis(catalogue: Catalogue, id: string): Piste[] | undefined {
  const piste = catalogue.pistes.find((p) => p.id === id);
  if (piste === undefined) return undefined;
  const album = piste.album !== undefined ? chercherAlbum(piste.album) : undefined;
  if (album === undefined) return [piste];
  const parId = new Map(catalogue.pistes.map((p) => [p.id, p]));
  return album.pistes
    .map((idPiste) => parId.get(idPiste))
    .filter((p): p is Piste => p !== undefined);
}

let barre: Barre | undefined;
let conteneur: HTMLElement | undefined;

/** Crée la barre de lecture fixe, branche raccourcis et Media Session, restaure la dernière piste. */
export function demarrerLecteur(): void {
  conteneur = document.createElement('div');
  conteneur.id = 'lecteur';
  document.body.append(conteneur);
  reconstruireBarre();
  installerRaccourcis(lecteur);
  brancherMediaSession(lecteur, chercherAlbum);

  // Réserve la hauteur de la barre en bas de page pour que rien ne passe dessous.
  new ResizeObserver(() => {
    document.documentElement.style.setProperty(
      '--hauteur-lecteur',
      `${conteneur?.offsetHeight ?? 0}px`,
    );
  }).observe(conteneur);

  chargerCatalogue()
    .then((catalogue) => {
      albums = new Map(catalogue.albums.map((a) => [a.id, a]));
      lecteur.restaurer((id) => fileDepuis(catalogue, id));
      reconstruireBarre();
    })
    .catch((erreur: unknown) => console.error(erreur));
}

/** Reconstruit la barre (changement de langue, album connu) sans toucher à l'état du lecteur. */
export function reconstruireBarre(): void {
  if (conteneur === undefined) return;
  barre?.detruire();
  barre = creerBarre(lecteur, chercherAlbum);
  conteneur.replaceChildren(barre.element);
}
