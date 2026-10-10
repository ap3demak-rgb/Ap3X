// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from '../i18n';
import { element } from './dom';
import { identifiantPisteDepot } from './depot';
import { lireHashtags, nomFichierPiste, type FormulairePiste } from './fiche';

export interface DonneesApercu {
  formulaire: FormulairePiste;
  /** Dossiers de catégories existants (pour calculer l'identifiant public). */
  categories: readonly string[];
  /** Adresse de la pochette (aperçu local ou pochette actuelle). */
  pochette?: string;
  /** Adresse d'un fichier audio à écouter (fichier choisi sur l'ordinateur). */
  audio?: string;
  /** Nom de fichier de base, quand la piste existe déjà (sinon déduit du titre). */
  base?: string;
}

/**
 * Aperçu de la page publique d'une piste : ce que verront les visiteurs (titre, artiste, catégorie,
 * hashtags, description, licence, pochette), sans rien publier. Les hashtags ne sont pas des liens.
 */
export function construireApercu(donnees: DonneesApercu): HTMLElement {
  const { formulaire } = donnees;
  const racine = element('article', 'admin-apercu-page');
  racine.append(element('p', 'carte-meta', t('admin.apercu.note')));

  if (donnees.pochette !== undefined) {
    const image = element('img', 'admin-apercu');
    image.src = donnees.pochette;
    image.alt = '';
    racine.append(image);
  }

  const titre = element('h3', undefined, formulaire.titre.trim() || t('admin.apercu.sans_titre'));
  racine.append(titre);
  if (!formulaire.visible)
    racine.append(element('p', 'admin-brouillon', t('admin.liste.brouillon')));

  const categorie = formulaire.categorie.trim();
  const lignes: [string, string][] = [
    [t('admin.nouvelle.artiste'), formulaire.artiste.trim()],
    [t('admin.nouvelle.categorie'), categorie],
    [t('admin.nouvelle.date'), formulaire.date.trim()],
    [t('admin.nouvelle.licence'), formulaire.licence.trim()],
    [t('admin.nouvelle.copyright'), formulaire.copyright.trim()],
  ];
  const meta = element('dl', 'meta');
  for (const [libelle, valeur] of lignes) {
    if (valeur === '') continue;
    meta.append(element('dt', undefined, libelle), element('dd', undefined, valeur));
  }
  racine.append(meta);

  const hashtags = lireHashtags(formulaire.hashtags);
  if (hashtags.length > 0) {
    racine.append(element('p', 'carte-meta', hashtags.map((h) => `#${h}`).join(' ')));
  }
  if (formulaire.description.trim() !== '') {
    racine.append(element('p', undefined, formulaire.description.trim()));
  }
  if (formulaire.telechargement) {
    racine.append(element('p', 'carte-meta', t('admin.apercu.telechargement')));
  }
  if (donnees.audio !== undefined) {
    const lecteur = element('audio');
    lecteur.controls = true;
    lecteur.preload = 'metadata';
    lecteur.src = donnees.audio;
    racine.append(lecteur);
  }

  const base = donnees.base ?? nomFichierPiste(formulaire.titre);
  const identifiant = identifiantPisteDepot({ categorie, base });
  racine.append(element('p', 'carte-meta', `${t('admin.apercu.identifiant')} : ${identifiant}`));
  return racine;
}
