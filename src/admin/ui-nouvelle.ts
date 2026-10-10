// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { normaliserDate } from '../catalogue/texte';
import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import { creerChampsPiste } from './champs-piste';
import { champ, element, formaterTaille } from './dom';
import type { DepotAnalyse, Espace } from './espace';
import {
  cheminsPiste,
  construireFiche,
  dossierCategorie,
  formulaireVide,
  nomFichierPiste,
  verifierFormulaire,
  type ChampInvalide,
  type FormulairePiste,
} from './fiche';
import type { Changement } from './github';
import { lireTagsFichier, type TagsId3 } from './id3';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { surveillerModifications } from './sortie';

function estMp3(fichier: File): boolean {
  return fichier.name.toLowerCase().endsWith('.mp3') || fichier.type === 'audio/mpeg';
}

/** Formulaire de création d'une piste : MP3, fiche et pochette partent dans un seul commit. */
export function construireNouvelle(
  espace: Espace,
  apresPublication: (message: string) => void,
): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-nouvelle-titre');
  const titre = element('h2', undefined, t('admin.nouvelle.titre'));
  titre.id = 'admin-nouvelle-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(titre, chargement);

  espace
    .depot()
    .then((depot) => {
      chargement.remove();
      racine.append(formulaire(espace, depot, apresPublication));
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
    });
  return racine;
}

function formulaire(
  espace: Espace,
  depot: DepotAnalyse,
  apresPublication: (message: string) => void,
): HTMLFormElement {
  const langue = document.documentElement.lang;
  const f = element('form', 'admin-formulaire');
  f.noValidate = true;

  let mp3: File | undefined;
  let adresseMp3: string | undefined;
  let envoiEnCours = false;
  const modifications = surveillerModifications(f);

  const champs = creerChampsPiste(depot, { audio: () => adresseMp3 });
  const valeursInitiales = formulaireVide();

  // --- Fichier MP3 -----------------------------------------------------------------------------
  const zone = element('div', 'admin-depot');
  const saisieMp3 = element('input');
  saisieMp3.type = 'file';
  saisieMp3.accept = 'audio/mpeg,.mp3';
  const indication = element('p', 'carte-meta', t('admin.nouvelle.glisser'));
  const nomMp3 = element('p', 'admin-fichier');
  nomMp3.setAttribute('role', 'status');
  zone.append(champ(t('admin.nouvelle.fichier'), saisieMp3), indication, nomMp3);

  // --- Retours ---------------------------------------------------------------------------------
  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = creerProgression();
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.nouvelle.enregistrer'));
  enregistrer.type = 'submit';

  f.append(...[zone, ...champs.elements], enregistrer, progression.element, erreurs);

  const controles: Record<ChampInvalide, HTMLElement> = {
    fichier: saisieMp3,
    titre: champs.controles.titre,
    categorie: champs.controles.categorie,
    date: champs.controles.date,
    doublon: champs.controles.titre,
  };

  /** Retient le MP3 choisi ou déposé et préremplit les champs vides avec ses tags ID3. */
  const choisirMp3 = async (fichier: File): Promise<void> => {
    if (!estMp3(fichier)) {
      nomMp3.textContent = '';
      erreurs.textContent = t('admin.nouvelle.err_mp3');
      return;
    }
    erreurs.textContent = '';
    mp3 = fichier;
    if (adresseMp3 !== undefined) URL.revokeObjectURL(adresseMp3);
    adresseMp3 = URL.createObjectURL(fichier);
    modifications.marquer();
    nomMp3.textContent = `${fichier.name} (${formaterTaille(fichier.size, langue)})`;
    const tags: TagsId3 = await lireTagsFichier(fichier).catch(() => ({}));
    const { saisies } = champs;
    let rempli = false;
    const remplir = (saisie: HTMLInputElement | HTMLTextAreaElement, valeur?: string): void => {
      if (valeur === undefined || valeur === '' || saisie.value.trim() !== '') return;
      saisie.value = valeur;
      rempli = true;
    };
    remplir(saisies.titre, tags.titre);
    if (tags.artiste !== undefined && saisies.artiste.value.trim() === valeursInitiales.artiste) {
      saisies.artiste.value = tags.artiste;
      rempli = true;
    }
    remplir(saisies.description, tags.commentaire);
    remplir(saisies.date, tags.date === undefined ? undefined : normaliserDate(tags.date));
    if (saisies.titre.value.trim() === '') {
      remplir(saisies.titre, fichier.name.replace(/\.mp3$/i, ''));
    }
    if (saisies.categorie.value === '' && tags.genre !== undefined) {
      const genre = tags.genre.toLowerCase();
      const dossier = depot.categories.find((d) => d.toLowerCase() === genre);
      if (dossier !== undefined) {
        saisies.categorie.value = dossier;
        rempli = true;
      }
    }
    if (rempli) annoncer(t('admin.nouvelle.tags_lus'));
  };

  saisieMp3.addEventListener('change', () => {
    const fichier = saisieMp3.files?.[0];
    if (fichier !== undefined) void choisirMp3(fichier);
  });
  zone.addEventListener('dragover', (evenement) => {
    evenement.preventDefault();
    zone.classList.add('survol');
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('survol'));
  zone.addEventListener('drop', (evenement) => {
    evenement.preventDefault();
    zone.classList.remove('survol');
    const fichier = evenement.dataTransfer?.files[0];
    if (fichier !== undefined) void choisirMp3(fichier);
  });

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;
    erreurs.textContent = '';
    for (const controle of Object.values(controles)) controle.removeAttribute('aria-invalid');

    const donnees = champs.lire();
    const problemes = verifierFormulaire(donnees, mp3 !== undefined, depot);
    if (problemes.length > 0) {
      const cles = {
        fichier: 'admin.nouvelle.err_fichier',
        titre: 'admin.nouvelle.err_titre',
        categorie: 'admin.nouvelle.err_categorie',
        date: 'admin.nouvelle.err_date',
        doublon: 'admin.nouvelle.err_doublon',
      } as const;
      for (const p of problemes) controles[p.champ].setAttribute('aria-invalid', 'true');
      erreurs.replaceChildren(
        ...problemes.map((p) => element('p', undefined, tv(cles[p.champ], { id: p.id ?? '' }))),
      );
      controles[problemes[0]?.champ ?? 'titre'].focus();
      return;
    }
    if (mp3 === undefined) return;
    void publier(mp3, donnees);
  });

  async function publier(fichier: File, donnees: FormulairePiste): Promise<void> {
    envoiEnCours = true;
    enregistrer.disabled = true;
    progression.demarrer();
    try {
      const categorie = dossierCategorie(donnees.categorie, depot.categories);
      const base = nomFichierPiste(donnees.titre);
      const chemins = cheminsPiste(categorie, base);
      const pochette = champs.pochette();
      const nomPochette = pochette === undefined ? undefined : `${base}${pochette.extension}`;
      const changements: Changement[] = [
        { chemin: chemins.mp3, contenu: new Uint8Array(await fichier.arrayBuffer()) },
        { chemin: chemins.fiche, contenu: construireFiche(donnees, nomPochette) },
      ];
      if (pochette !== undefined) {
        changements.push({
          chemin: chemins.image(pochette.extension),
          contenu: new Uint8Array(await pochette.blob.arrayBuffer()),
        });
      }
      const message = donnees.visible
        ? `ajout: piste « ${donnees.titre.trim()} »`
        : `ajout: brouillon de piste « ${donnees.titre.trim()} »`;
      await espace.client.commit(message, changements, (avancement) =>
        progression.mettreAJour(avancement),
      );
      modifications.oublier();
      espace.invalider();
      const succes = donnees.visible
        ? t('admin.nouvelle.ok_publie')
        : t('admin.nouvelle.ok_brouillon');
      progression.terminer(succes);
      annoncer(succes);
      apresPublication(succes);
    } catch (erreur) {
      progression.terminer();
      erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      envoiEnCours = false;
      enregistrer.disabled = false;
    }
  }

  return f;
}
