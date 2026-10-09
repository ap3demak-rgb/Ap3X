// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import './styles/theme.css';
import './styles/mise-en-page.css';
import './styles/lecteur.css';
import './styles/cartes.css';
import './styles/rendu3d.css';
import './styles/formulaires.css';
import { chargerLangue, obtenirLangue, t } from './i18n';
import { demarrerLecteur, reconstruireBarre } from './lecteur';
import { enregistrerServiceWorker } from './pwa';
import { demarrerRendu3d } from './rendu3d';
import { pageAccueil } from './pages/accueil';
import { pageAlbum } from './pages/album';
import { pageAlbums } from './pages/albums';
import { pageArtiste } from './pages/artiste';
import { pageCategorie, pageCategories } from './pages/categorie';
import { pageLicences } from './pages/licences';
import { pagePiste } from './pages/piste';
import { pagePlaylist } from './pages/playlist';
import { pagePlaylists } from './pages/playlists';
import { pageRecherche } from './pages/recherche';
import { pageTag } from './pages/tag';
import { ecouterRoute, instantDeLHash, routeCourante, type Route } from './routeur';
import { annonceur, annoncer } from './ui/annonceur';
import { bandeau } from './ui/bandeau';
import { entete, evitement, NOMS_LANGUES, pied } from './ui/gabarit';

const racine = document.getElementById('app');
if (racine === null) {
  throw new Error('Élément #app introuvable');
}

function page(route: Route, demarrerPiste: boolean): HTMLElement {
  switch (route.nom) {
    case 'licences':
      return pageLicences();
    case 'albums':
      return pageAlbums();
    case 'album':
      return pageAlbum(route.id);
    case 'piste':
      return pagePiste(route.id, {
        demarrer: demarrerPiste,
        instant: instantDeLHash(window.location.hash),
      });
    case 'categories':
      return pageCategories();
    case 'categorie':
      return pageCategorie(route.id);
    case 'tag':
      return pageTag(route.id);
    case 'artiste':
      return pageArtiste(route.id);
    case 'playlists':
      return pagePlaylists();
    case 'playlist':
      return pagePlaylist(route.id);
    case 'recherche':
      return pageRecherche(route.id);
    case 'accueil':
      return pageAccueil();
  }
}

/** Affiche la page courante. `navigation` : déplace le focus sur le contenu et remonte en haut. */
type Origine = 'initiale' | 'navigation' | 'langue';

function afficher(conteneur: HTMLElement, origine: Origine): void {
  const navigation = origine === 'navigation';
  // Un lien partagé lance la lecture : à l'ouverture du site, ou quand l'adresse change vers un lien
  // qui porte un instant (?t=…). Parcourir le site ou changer de langue ne lance jamais la lecture.
  const demarrerPiste =
    origine === 'initiale' || (navigation && instantDeLHash(window.location.hash) !== undefined);
  const principal = document.createElement('main');
  principal.tabIndex = -1;
  principal.append(page(routeCourante(), demarrerPiste));

  conteneur.replaceChildren(evitement(principal), entete(), bandeau.element, principal, pied());
  if (navigation) {
    window.scrollTo(0, 0);
    principal.focus({ preventScroll: true });
  }
}

// Le dictionnaire de la langue du visiteur doit être là avant le premier affichage.
await chargerLangue(obtenirLangue());
document.body.append(annonceur.element);
afficher(racine, 'initiale');
demarrerLecteur();
enregistrerServiceWorker();
// Le rendu 3D (Three.js) n'est que décoratif : il démarre quelques secondes après le chargement, quand
// le contenu est déjà affiché. Lancé plus tôt, il monopolise le processeur (compilation des shaders,
// création du contexte WebGL) et retarde le premier affichage du contenu (LCP de plusieurs secondes sur
// un appareil modeste).
const DELAI_RENDU_3D_MS = 2500;
const programmerRendu3d = (): void => {
  window.setTimeout(() => {
    if ('requestIdleCallback' in window) window.requestIdleCallback(demarrerRendu3d);
    else demarrerRendu3d();
  }, DELAI_RENDU_3D_MS);
};
if (document.readyState === 'complete') programmerRendu3d();
else window.addEventListener('load', programmerRendu3d, { once: true });
window.addEventListener('changement-langue', () => {
  afficher(racine, 'langue');
  reconstruireBarre();
  annoncer(`${t('langue.libelle')} : ${NOMS_LANGUES[obtenirLangue()]}`);
});
ecouterRoute(() => afficher(racine, 'navigation'));
