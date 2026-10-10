// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from '../i18n';
import { comptePistes } from '../i18n/format';
import { champ, element } from './dom';
import type { Espace } from './espace';
import {
  filtrerLignes,
  hashtagsDeLaListe,
  lignePiste,
  type CriteresListe,
  type LignePiste,
  type TriListe,
} from './liste';
import { messageErreur } from './messages';

/** Liste des pistes du dépôt (brouillons compris) avec recherche, filtres et tri. */
export function construirePistes(espace: Espace): HTMLElement {
  const racine = element('section', 'admin-pistes');
  racine.setAttribute('aria-labelledby', 'admin-pistes-titre');
  const titre = element('h2', undefined, t('admin.liste.titre'));
  titre.id = 'admin-pistes-titre';
  const etat = element('p', 'carte-meta', t('admin.liste.chargement'));
  etat.setAttribute('role', 'status');
  racine.append(titre, etat);

  void (async () => {
    try {
      const depot = await espace.depot();
      const pistes = depot.pistes;
      const resumes = await espace.resumesDe(pistes, (recus) => {
        // Annonce rare : tous les dix titres, pour ne pas saturer un lecteur d'écran.
        if (recus % 10 === 0)
          etat.textContent = `${t('admin.liste.chargement')} ${recus}/${pistes.length}`;
      });
      const lignes = pistes.map((piste, i) => lignePiste(piste, resumes[i]));
      etat.remove();
      racine.append(...construireListe(lignes, depot.categories, depot.tronque));
    } catch (erreur) {
      etat.setAttribute('role', 'alert');
      etat.textContent = messageErreur(erreur);
    }
  })();
  return racine;
}

function construireListe(
  lignes: LignePiste[],
  categories: string[],
  tronque: boolean,
): HTMLElement[] {
  const criteres: CriteresListe = { recherche: '', categorie: '', hashtag: '', tri: 'titre' };

  const recherche = element('input');
  recherche.type = 'search';
  recherche.autocomplete = 'off';

  const selectionCategorie = element('select');
  selectionCategorie.append(new Option(t('admin.liste.toutes'), ''));
  for (const dossier of categories) selectionCategorie.append(new Option(dossier, dossier));

  const selectionHashtag = element('select');
  selectionHashtag.append(new Option(t('admin.liste.tous'), ''));
  for (const hashtag of hashtagsDeLaListe(lignes)) {
    selectionHashtag.append(new Option(`#${hashtag}`, hashtag));
  }

  const selectionTri = element('select');
  selectionTri.append(
    new Option(t('admin.liste.tri_titre'), 'titre'),
    new Option(t('admin.liste.tri_categorie'), 'categorie'),
  );

  const barre = element('div', 'formulaire-ligne');
  barre.append(
    champ(t('admin.liste.recherche'), recherche),
    champ(t('admin.liste.categorie'), selectionCategorie),
    champ(t('admin.liste.hashtag'), selectionHashtag),
    champ(t('admin.liste.tri'), selectionTri),
  );

  const compte = element('p', 'carte-meta');
  compte.setAttribute('role', 'status');
  const liste = element('ul', 'admin-liste');
  const avertissement = element('p', 'carte-meta', tronque ? t('admin.liste.tronque') : '');

  const afficher = (): void => {
    const visibles = filtrerLignes(lignes, criteres, document.documentElement.lang);
    compte.textContent =
      visibles.length === 0 ? t('admin.liste.vide') : comptePistes(visibles.length);
    liste.replaceChildren(...visibles.map(ligneDeListe));
  };

  recherche.addEventListener('input', () => {
    criteres.recherche = recherche.value;
    afficher();
  });
  selectionCategorie.addEventListener('change', () => {
    criteres.categorie = selectionCategorie.value;
    afficher();
  });
  selectionHashtag.addEventListener('change', () => {
    criteres.hashtag = selectionHashtag.value;
    afficher();
  });
  selectionTri.addEventListener('change', () => {
    criteres.tri = selectionTri.value as TriListe;
    afficher();
  });
  afficher();
  return [barre, compte, liste, avertissement];
}

function ligneDeListe(ligne: LignePiste): HTMLElement {
  const item = element('li', 'admin-ligne');
  const titre = element('strong', undefined, ligne.titre);
  const details = [ligne.artiste, ligne.album ?? '', ligne.categorie]
    .filter((d) => d !== '')
    .join(' · ');
  item.append(titre);
  if (!ligne.visible)
    item.append(' ', element('span', 'admin-brouillon', t('admin.liste.brouillon')));
  item.append(element('div', 'carte-meta', details));
  if (ligne.hashtags.length > 0) {
    item.append(element('div', 'carte-meta', ligne.hashtags.map((h) => `#${h}`).join(' ')));
  }
  return item;
}
