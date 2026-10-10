// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from '../i18n';
import { construireApercu } from './apercu';
import { creerChampCategorie, creerChampPochette } from './champs-communs';
import { champ, element } from './dom';
import type { DepotAnalyse } from './espace';
import { formulaireVide, lireHashtags, type FormulairePiste } from './fiche';
import type { PochettePreparee } from './image';

export { NOUVELLE_CATEGORIE } from './champs-communs';

export type ChampControle = 'titre' | 'categorie' | 'date';

export interface OptionsChamps {
  /** Adresse d'un fichier audio à écouter dans l'aperçu (fichier choisi ou piste publiée). */
  audio?: () => string | undefined;
  /** Adresse de la pochette actuelle, quand aucune nouvelle image n'est choisie. */
  pochetteActuelle?: () => string | undefined;
  /** Nom de fichier de base d'une piste existante. */
  base?: () => string | undefined;
}

export interface ChampsPiste {
  /** Champs dans l'ordre d'affichage, à insérer dans un formulaire. */
  elements: HTMLElement[];
  saisies: {
    titre: HTMLInputElement;
    artiste: HTMLInputElement;
    description: HTMLTextAreaElement;
    date: HTMLInputElement;
    categorie: HTMLSelectElement;
  };
  controles: Record<ChampControle, HTMLElement>;
  lire(): FormulairePiste;
  ecrire(valeurs: FormulairePiste): void;
  /** Nouvelle pochette choisie, déjà redimensionnée. */
  pochette(): PochettePreparee | undefined;
}

/** Champs communs à la création et à la modification d'une piste (fiche JSON et pochette). */
export function creerChampsPiste(depot: DepotAnalyse, options: OptionsChamps = {}): ChampsPiste {
  const valeurs = formulaireVide();

  const titre = element('input');
  titre.type = 'text';
  titre.required = true;
  const artiste = element('input');
  artiste.type = 'text';
  artiste.value = valeurs.artiste;
  const description = element('textarea');
  description.rows = 4;

  const categorie = creerChampCategorie(depot);

  const hashtags = element('input');
  hashtags.type = 'text';
  hashtags.placeholder = '#ambient #nuit';
  const date = element('input');
  date.type = 'text';
  date.placeholder = 'YYYY-MM-DD';
  date.inputMode = 'numeric';
  const licence = element('input');
  licence.type = 'text';
  licence.value = valeurs.licence;
  const copyright = element('input');
  copyright.type = 'text';
  copyright.value = valeurs.copyright;

  const telechargement = element('input');
  telechargement.type = 'checkbox';
  const publier = element('input');
  publier.type = 'checkbox';
  publier.checked = true;
  const caseEtiquette = (libelle: string, controle: HTMLInputElement): HTMLLabelElement => {
    const etiquette = element('label', 'champ-case');
    etiquette.append(controle, element('span', undefined, libelle));
    return etiquette;
  };

  const pochette = creerChampPochette();

  // --- Aperçu de la page publique ---------------------------------------------------------------
  const boutonApercu = element('button', 'bouton', t('admin.apercu.bouton'));
  boutonApercu.type = 'button';
  boutonApercu.setAttribute('aria-expanded', 'false');
  const zoneApercu = element('div');
  zoneApercu.hidden = true;
  const actualiserApercu = (): void => {
    const adresse = pochette.adresse() ?? options.pochetteActuelle?.();
    const audio = options.audio?.();
    const base = options.base?.();
    zoneApercu.replaceChildren(
      construireApercu({
        formulaire: lire(),
        categories: depot.categories,
        ...(adresse !== undefined && { pochette: adresse }),
        ...(audio !== undefined && { audio }),
        ...(base !== undefined && { base }),
      }),
    );
  };
  boutonApercu.addEventListener('click', () => {
    const ouvert = boutonApercu.getAttribute('aria-expanded') === 'true';
    boutonApercu.setAttribute('aria-expanded', String(!ouvert));
    zoneApercu.hidden = ouvert;
    if (!ouvert) actualiserApercu();
  });

  function lire(): FormulairePiste {
    return {
      titre: titre.value,
      artiste: artiste.value,
      description: description.value,
      categorie: categorie.lire(),
      hashtags: hashtags.value,
      date: date.value,
      visible: publier.checked,
      telechargement: telechargement.checked,
      licence: licence.value,
      copyright: copyright.value,
    };
  }

  function ecrire(v: FormulairePiste): void {
    titre.value = v.titre;
    artiste.value = v.artiste;
    description.value = v.description;
    categorie.ecrire(v.categorie);
    hashtags.value = lireHashtags(v.hashtags)
      .map((h) => `#${h}`)
      .join(' ');
    date.value = v.date;
    publier.checked = v.visible;
    telechargement.checked = v.telechargement;
    licence.value = v.licence;
    copyright.value = v.copyright;
  }

  return {
    elements: [
      champ(t('admin.nouvelle.champ_titre'), titre),
      champ(t('admin.nouvelle.artiste'), artiste),
      champ(t('admin.nouvelle.description'), description),
      ...categorie.elements,
      champ(t('admin.nouvelle.hashtags'), hashtags),
      champ(t('admin.nouvelle.date'), date),
      champ(t('admin.nouvelle.licence'), licence),
      champ(t('admin.nouvelle.copyright'), copyright),
      caseEtiquette(t('admin.nouvelle.telechargement'), telechargement),
      caseEtiquette(t('admin.nouvelle.publier'), publier),
      ...pochette.elements,
      boutonApercu,
      zoneApercu,
    ],
    saisies: { titre, artiste, description, date, categorie: categorie.select },
    controles: { titre, categorie: categorie.select, date },
    lire,
    ecrire,
    pochette: pochette.pochette,
  };
}
