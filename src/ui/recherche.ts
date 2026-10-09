// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { chargerCatalogue } from '../catalogue/charger';
import { donneesDe } from '../catalogue/donnees';
import { motsDeRecherche, rechercher, type ResultatsRecherche } from '../catalogue/recherche';
import { t, tv } from '../i18n';
import {
  lienAlbum,
  lienArtiste,
  lienCategorie,
  lienPiste,
  lienRecherche,
  lienTag,
} from '../routeur';

/** Nombre maximal de résultats par type dans le panneau ; la page de résultats les montre tous. */
const PAR_TYPE = 5;

interface Section {
  titre: string;
  liens: { href: string; texte: string }[];
}

function sections(resultats: ResultatsRecherche): Section[] {
  return [
    {
      titre: t('categorie.titres'),
      liens: resultats.pistes.slice(0, PAR_TYPE).map((p) => ({
        href: lienPiste(p.id),
        texte: `${p.titre} – ${p.artiste}`,
      })),
    },
    {
      titre: t('nav.albums'),
      liens: resultats.albums.slice(0, PAR_TYPE).map((a) => ({
        href: lienAlbum(a.id),
        texte: `${a.titre} – ${a.artiste}`,
      })),
    },
    {
      titre: t('recherche.artistes'),
      liens: resultats.artistes
        .slice(0, PAR_TYPE)
        .map((a) => ({ href: lienArtiste(a.nom), texte: a.nom })),
    },
    {
      titre: t('piste.hashtags'),
      liens: resultats.hashtags
        .slice(0, PAR_TYPE)
        .map((h) => ({ href: lienTag(h.nom), texte: `#${h.nom}` })),
    },
    {
      titre: t('nav.categories'),
      liens: resultats.categories
        .slice(0, PAR_TYPE)
        .map((c) => ({ href: lienCategorie(c.slug), texte: c.nom })),
    },
  ].filter((section) => section.liens.length > 0);
}

/**
 * Formulaire de recherche de l'en-tête : les résultats s'affichent en temps réel dans un panneau,
 * groupés par type. Flèches haut/bas pour parcourir, Échap pour fermer, Entrée pour la page complète.
 */
export function formulaireRecherche(): HTMLFormElement {
  const formulaire = document.createElement('form');
  formulaire.className = 'recherche';
  formulaire.setAttribute('role', 'search');
  formulaire.action = '#';

  const saisie = document.createElement('input');
  saisie.type = 'search';
  saisie.name = 'q';
  saisie.className = 'recherche-saisie';
  saisie.autocomplete = 'off';
  saisie.placeholder = t('recherche.placeholder');
  saisie.setAttribute('aria-label', t('recherche.libelle'));

  const panneau = document.createElement('div');
  panneau.id = 'resultats-recherche';
  panneau.className = 'resultats-recherche';
  panneau.hidden = true;

  const etat = document.createElement('div');
  etat.className = 'visuellement-cache';
  etat.setAttribute('role', 'status');
  etat.setAttribute('aria-live', 'polite');

  formulaire.append(saisie, panneau, etat);

  const fermer = (): void => {
    panneau.hidden = true;
  };

  const liens = (): HTMLAnchorElement[] => [...panneau.querySelectorAll('a')];

  function afficher(resultats: ResultatsRecherche, requete: string): void {
    panneau.replaceChildren();
    if (resultats.total === 0) {
      const vide = document.createElement('p');
      vide.className = 'resultats-vide';
      vide.textContent = tv('recherche.aucun', { q: requete });
      panneau.append(vide);
    }
    for (const section of sections(resultats)) {
      const bloc = document.createElement('section');
      const titre = document.createElement('h2');
      titre.textContent = section.titre;
      const liste = document.createElement('ul');
      for (const { href, texte } of section.liens) {
        const element = document.createElement('li');
        const a = document.createElement('a');
        a.href = href;
        a.textContent = texte;
        element.append(a);
        liste.append(element);
      }
      bloc.append(titre, liste);
      panneau.append(bloc);
    }
    if (resultats.total > 0) {
      const tout = document.createElement('a');
      tout.className = 'resultats-tout';
      tout.href = lienRecherche(requete);
      tout.textContent = t('recherche.voir_tout');
      panneau.append(tout);
    }
    panneau.hidden = false;
    etat.textContent = tv('recherche.compte', { n: resultats.total });
  }

  saisie.addEventListener('input', () => {
    const requete = saisie.value;
    if (motsDeRecherche(requete).length === 0) {
      fermer();
      etat.textContent = '';
      return;
    }
    chargerCatalogue()
      .then((catalogue) => {
        // Une saisie plus récente a pu remplacer celle-ci pendant le chargement.
        if (saisie.value !== requete) return;
        afficher(rechercher(donneesDe(catalogue), requete), requete.trim());
      })
      .catch((erreur: unknown) => console.error(erreur));
  });

  formulaire.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    const requete = saisie.value.trim();
    if (motsDeRecherche(requete).length === 0) return;
    fermer();
    window.location.hash = lienRecherche(requete);
  });

  formulaire.addEventListener('keydown', (evenement) => {
    const tous = liens();
    const actuel = tous.indexOf(document.activeElement as HTMLAnchorElement);
    if (evenement.key === 'Escape' && !panneau.hidden) {
      evenement.preventDefault();
      fermer();
      saisie.focus();
    } else if (evenement.key === 'ArrowDown' && tous.length > 0 && !panneau.hidden) {
      evenement.preventDefault();
      tous[Math.min(tous.length - 1, actuel + 1)]?.focus();
    } else if (evenement.key === 'ArrowUp' && actuel >= 0) {
      evenement.preventDefault();
      if (actuel === 0) saisie.focus();
      else tous[actuel - 1]?.focus();
    }
  });

  // Fermeture quand le focus quitte tout le formulaire (Tab, clic ailleurs).
  formulaire.addEventListener('focusout', (evenement) => {
    const suivant = evenement.relatedTarget;
    if (!(suivant instanceof Node) || !formulaire.contains(suivant)) fermer();
  });
  // Un clic sur un lien du panneau navigue ; on referme sans attendre le changement de page.
  panneau.addEventListener('click', (evenement) => {
    if ((evenement.target as HTMLElement).closest('a') !== null) fermer();
  });

  return formulaire;
}
