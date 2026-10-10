// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { TYPES_ALBUM } from '../catalogue/schemas';
import { t, tv } from '../i18n';
import { compteAlbums, comptePistes } from '../i18n/format';
import { annoncer } from '../ui/annonceur';
import { choisirOption } from '../ui/dialogue';
import { planSuppressionAlbum } from './album';
import { champ, element } from './dom';
import type { DepotAnalyse, Espace } from './espace';
import {
  anneesDesAlbums,
  filtrerAlbums,
  ligneAlbum,
  type CriteresAlbums,
  type LigneAlbum,
} from './liste-albums';
import { messageErreur } from './messages';
import { creerProgression } from './progression';

export interface ActionsAlbums {
  /** Ouvre le formulaire de modification d'un album. */
  modifier: (ligne: LigneAlbum) => void;
  /** Une suppression est terminée : recharger la liste avec ce message. */
  termine: (message: string) => void;
}

/** Liste des albums du dépôt (brouillons et albums incomplets compris) : filtres, modification, suppression. */
export function construireAlbums(espace: Espace, actions: ActionsAlbums): HTMLElement {
  const racine = element('section', 'admin-albums');
  racine.setAttribute('aria-labelledby', 'admin-albums-titre');
  const titre = element('h2', undefined, t('admin.albums.titre'));
  titre.id = 'admin-albums-titre';
  const etat = element('p', 'carte-meta', t('admin.liste.chargement'));
  etat.setAttribute('role', 'status');
  racine.append(titre, etat);

  void (async () => {
    try {
      const depot = await espace.depot();
      const fiches = await espace.fichesAlbumsDe(depot.albums);
      const lignes = depot.albums.map((album) => ligneAlbum(album, fiches.get(album.fiche.chemin)));
      etat.remove();
      racine.append(...construireListe(espace, depot, lignes, actions));
    } catch (erreur) {
      etat.setAttribute('role', 'alert');
      etat.textContent = messageErreur(erreur);
    }
  })();
  return racine;
}

function construireListe(
  espace: Espace,
  depot: DepotAnalyse,
  lignes: LigneAlbum[],
  actions: ActionsAlbums,
): HTMLElement[] {
  const criteres: CriteresAlbums = { recherche: '', type: '', categorie: '', annee: '' };

  const recherche = element('input');
  recherche.type = 'search';
  recherche.autocomplete = 'off';
  const selectionType = element('select');
  selectionType.append(new Option(t('admin.albums.tous_types'), ''));
  for (const type of TYPES_ALBUM) selectionType.append(new Option(t(`type.${type}`), type));
  const selectionCategorie = element('select');
  selectionCategorie.append(new Option(t('admin.liste.toutes'), ''));
  for (const dossier of depot.categories) selectionCategorie.append(new Option(dossier, dossier));
  const selectionAnnee = element('select');
  selectionAnnee.append(new Option(t('admin.albums.toutes_annees'), ''));
  for (const annee of anneesDesAlbums(lignes)) selectionAnnee.append(new Option(annee, annee));

  const barre = element('div', 'formulaire-ligne');
  barre.append(
    champ(t('admin.liste.recherche'), recherche),
    champ(t('admin.albums.filtre_type'), selectionType),
    champ(t('admin.liste.categorie'), selectionCategorie),
    champ(t('admin.albums.filtre_annee'), selectionAnnee),
  );

  const compte = element('p', 'carte-meta');
  compte.setAttribute('role', 'status');
  const liste = element('ul', 'admin-liste');
  const retour = element('div', 'erreur-champ');
  retour.setAttribute('role', 'alert');
  const progression = creerProgression();
  let occupe = false;

  const afficher = (): void => {
    const visibles = filtrerAlbums(lignes, criteres, document.documentElement.lang);
    compte.textContent =
      visibles.length === 0 ? t('admin.albums.vide') : compteAlbums(visibles.length);
    liste.replaceChildren(...visibles.map(ligneDeListe));
  };

  function ligneDeListe(ligne: LigneAlbum): HTMLElement {
    const item = element('li', 'admin-ligne');
    const corps = element('div', 'admin-ligne-corps');
    corps.append(element('strong', undefined, ligne.titre));
    if (!ligne.visible) {
      corps.append(' ', element('span', 'admin-brouillon', t('admin.liste.brouillon')));
    }
    if (ligne.incomplet || ligne.illisible) {
      corps.append(' ', element('span', 'admin-brouillon', t('admin.albums.incomplet')));
    }
    const details = [
      t(`type.${ligne.type}`),
      ligne.artiste,
      ligne.categorie,
      ligne.annee ?? '',
      comptePistes(ligne.nombrePistes),
    ]
      .filter((d) => d !== '')
      .join(' · ');
    corps.append(element('div', 'carte-meta', details));

    const modifier = element('button', 'bouton', t('admin.liste.modifier'));
    modifier.type = 'button';
    modifier.setAttribute('aria-label', `${t('admin.liste.modifier')} : ${ligne.titre}`);
    modifier.disabled = ligne.illisible;
    modifier.addEventListener('click', () => actions.modifier(ligne));
    const supprimer = element('button', 'bouton', t('admin.liste.supprimer'));
    supprimer.type = 'button';
    supprimer.setAttribute('aria-label', `${t('admin.liste.supprimer')} : ${ligne.titre}`);
    supprimer.addEventListener('click', () => void supprimerAlbum(ligne));
    const boutons = element('div', 'admin-actions');
    boutons.append(modifier, supprimer);
    item.append(corps, boutons);
    return item;
  }

  async function supprimerAlbum(ligne: LigneAlbum): Promise<void> {
    if (occupe) return;
    retour.textContent = '';
    const choix = await choisirOption(
      t('admin.albums.supprimer_titre'),
      tv('admin.albums.supprimer_message', { titre: ligne.titre }),
      t('admin.albums.supprimer_choix'),
      [
        { valeur: 'conserver', libelle: t('admin.albums.supprimer_conserver') },
        { valeur: 'tout', libelle: t('admin.albums.supprimer_tout') },
      ],
      t('admin.albums.supprimer_confirmer'),
    );
    if (choix !== 'conserver' && choix !== 'tout') return;
    occupe = true;
    progression.demarrer();
    try {
      const fiche = await espace.ficheAlbum(ligne.album);
      const fichesPistes = await espace.fichesDe(ligne.album.pistes);
      const plan = planSuppressionAlbum(ligne.album, fiche, fichesPistes, choix, depot);
      if (!plan.ok) {
        progression.terminer();
        retour.replaceChildren(
          ...plan.erreurs.map((e) =>
            element('p', undefined, tv('admin.album.err_retrait', { id: e.id ?? '' })),
          ),
        );
        return;
      }
      await espace.client.commit(plan.message, plan.changements, (avancement) =>
        progression.mettreAJour(avancement),
      );
      espace.invalider();
      const succes = t('admin.albums.supprimer_ok');
      annoncer(succes);
      actions.termine(succes);
    } catch (erreur) {
      progression.terminer();
      retour.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      occupe = false;
    }
  }

  recherche.addEventListener('input', () => {
    criteres.recherche = recherche.value;
    afficher();
  });
  selectionType.addEventListener('change', () => {
    criteres.type = selectionType.value as CriteresAlbums['type'];
    afficher();
  });
  selectionCategorie.addEventListener('change', () => {
    criteres.categorie = selectionCategorie.value;
    afficher();
  });
  selectionAnnee.addEventListener('change', () => {
    criteres.annee = selectionAnnee.value;
    afficher();
  });
  afficher();
  return [barre, compte, progression.element, retour, liste];
}
