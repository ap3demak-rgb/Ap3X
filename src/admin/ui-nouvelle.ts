// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { normaliserDate } from '../catalogue/texte';
import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
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
import { lireTagsFichier } from './id3';
import { preparerPochette, type PochettePreparee } from './image';
import { messageErreur } from './messages';

const NOUVELLE_CATEGORIE = '\u0000nouvelle';

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
  let pochette: PochettePreparee | undefined;
  let modifie = false;
  let envoiEnCours = false;

  const avantFermeture = (evenement: BeforeUnloadEvent): void => {
    evenement.preventDefault();
  };
  const marquerModifie = (): void => {
    if (modifie) return;
    modifie = true;
    window.addEventListener('beforeunload', avantFermeture);
  };
  const oublierModifications = (): void => {
    modifie = false;
    window.removeEventListener('beforeunload', avantFermeture);
  };
  // Le formulaire quitte la page (navigation interne) : plus d'avertissement à gérer.
  const surveillance = new MutationObserver(() => {
    if (!f.isConnected) {
      oublierModifications();
      surveillance.disconnect();
    }
  });
  queueMicrotask(() => surveillance.observe(document.body, { childList: true, subtree: true }));

  // --- Fichier MP3 -----------------------------------------------------------------------------
  const zone = element('div', 'admin-depot');
  const saisieMp3 = element('input');
  saisieMp3.type = 'file';
  saisieMp3.accept = 'audio/mpeg,.mp3';
  const indication = element('p', 'carte-meta', t('admin.nouvelle.glisser'));
  const nomMp3 = element('p', 'admin-fichier');
  nomMp3.setAttribute('role', 'status');
  zone.append(champ(t('admin.nouvelle.fichier'), saisieMp3), indication, nomMp3);

  // --- Champs ----------------------------------------------------------------------------------
  const valeurs: FormulairePiste = formulaireVide();
  const titreSaisie = element('input');
  titreSaisie.type = 'text';
  titreSaisie.required = true;
  const artisteSaisie = element('input');
  artisteSaisie.type = 'text';
  artisteSaisie.value = valeurs.artiste;
  const descriptionSaisie = element('textarea');
  descriptionSaisie.rows = 4;

  const categorieSelect = element('select');
  categorieSelect.append(new Option('', ''));
  for (const dossier of depot.categories) categorieSelect.append(new Option(dossier, dossier));
  categorieSelect.append(new Option(t('admin.nouvelle.categorie_nouvelle'), NOUVELLE_CATEGORIE));
  const categorieNom = element('input');
  categorieNom.type = 'text';
  const categorieNomChamp = champ(t('admin.nouvelle.categorie_nom'), categorieNom);
  categorieNomChamp.hidden = true;

  const hashtagsSaisie = element('input');
  hashtagsSaisie.type = 'text';
  hashtagsSaisie.placeholder = '#ambient #nuit';
  const dateSaisie = element('input');
  dateSaisie.type = 'text';
  dateSaisie.placeholder = 'YYYY-MM-DD';
  dateSaisie.inputMode = 'numeric';
  const licenceSaisie = element('input');
  licenceSaisie.type = 'text';
  licenceSaisie.value = valeurs.licence;
  const copyrightSaisie = element('input');
  copyrightSaisie.type = 'text';
  copyrightSaisie.value = valeurs.copyright;

  const caseTelechargement = element('input');
  caseTelechargement.type = 'checkbox';
  const casePublier = element('input');
  casePublier.type = 'checkbox';
  casePublier.checked = true;

  const caseEtiquette = (libelle: string, controle: HTMLInputElement): HTMLLabelElement => {
    const etiquette = element('label', 'champ-case');
    etiquette.append(controle, element('span', undefined, libelle));
    return etiquette;
  };

  // --- Pochette --------------------------------------------------------------------------------
  const saisiePochette = element('input');
  saisiePochette.type = 'file';
  saisiePochette.accept = 'image/*';
  const apercu = element('img', 'admin-apercu');
  apercu.alt = '';
  apercu.hidden = true;
  const infoPochette = element('p', 'carte-meta');
  infoPochette.setAttribute('role', 'status');
  let adresseApercu: string | undefined;

  // --- Retours ---------------------------------------------------------------------------------
  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = element('progress', 'admin-progression');
  progression.max = 100;
  progression.value = 0;
  progression.hidden = true;
  progression.setAttribute('aria-label', t('admin.nouvelle.envoi'));
  const etatEnvoi = element('p', 'carte-meta');
  etatEnvoi.setAttribute('role', 'status');
  const enregistrer = element('button', 'bouton bouton-principal', t('admin.nouvelle.enregistrer'));
  enregistrer.type = 'submit';

  f.append(
    zone,
    champ(t('admin.nouvelle.champ_titre'), titreSaisie),
    champ(t('admin.nouvelle.artiste'), artisteSaisie),
    champ(t('admin.nouvelle.description'), descriptionSaisie),
    champ(t('admin.nouvelle.categorie'), categorieSelect),
    categorieNomChamp,
    champ(t('admin.nouvelle.hashtags'), hashtagsSaisie),
    champ(t('admin.nouvelle.date'), dateSaisie),
    champ(t('admin.nouvelle.licence'), licenceSaisie),
    champ(t('admin.nouvelle.copyright'), copyrightSaisie),
    caseEtiquette(t('admin.nouvelle.telechargement'), caseTelechargement),
    caseEtiquette(t('admin.nouvelle.publier'), casePublier),
    champ(t('admin.nouvelle.pochette'), saisiePochette),
    apercu,
    infoPochette,
    enregistrer,
    progression,
    etatEnvoi,
    erreurs,
  );

  const controles: Record<ChampInvalide, HTMLElement> = {
    fichier: saisieMp3,
    titre: titreSaisie,
    categorie: categorieSelect,
    date: dateSaisie,
    doublon: titreSaisie,
  };

  // --- Comportements ---------------------------------------------------------------------------
  f.addEventListener('input', marquerModifie);
  f.addEventListener('change', marquerModifie);
  categorieSelect.addEventListener('change', () => {
    const nouvelle = categorieSelect.value === NOUVELLE_CATEGORIE;
    categorieNomChamp.hidden = !nouvelle;
    if (nouvelle) categorieNom.focus();
  });

  /** Retient le MP3 choisi ou déposé et préremplit les champs vides avec ses tags ID3. */
  const choisirMp3 = async (fichier: File): Promise<void> => {
    if (!estMp3(fichier)) {
      nomMp3.textContent = '';
      erreurs.textContent = t('admin.nouvelle.err_mp3');
      return;
    }
    erreurs.textContent = '';
    mp3 = fichier;
    marquerModifie();
    nomMp3.textContent = `${fichier.name} (${formaterTaille(fichier.size, langue)})`;
    const tags = await lireTagsFichier(fichier).catch(
      () => ({}) as Awaited<ReturnType<typeof lireTagsFichier>>,
    );
    let rempli = false;
    const remplir = (saisie: HTMLInputElement | HTMLTextAreaElement, valeur?: string): void => {
      if (valeur === undefined || valeur === '' || saisie.value.trim() !== '') return;
      saisie.value = valeur;
      rempli = true;
    };
    remplir(titreSaisie, tags.titre);
    if (tags.artiste !== undefined && artisteSaisie.value.trim() === valeurs.artiste) {
      artisteSaisie.value = tags.artiste;
      rempli = true;
    }
    remplir(descriptionSaisie, tags.commentaire);
    remplir(dateSaisie, tags.date === undefined ? undefined : normaliserDate(tags.date));
    if (titreSaisie.value.trim() === '') remplir(titreSaisie, fichier.name.replace(/\.mp3$/i, ''));
    if (categorieSelect.value === '' && tags.genre !== undefined) {
      const genre = tags.genre.toLowerCase();
      const dossier = depot.categories.find((d) => d.toLowerCase() === genre);
      if (dossier !== undefined) {
        categorieSelect.value = dossier;
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

  saisiePochette.addEventListener('change', () => {
    const fichier = saisiePochette.files?.[0];
    pochette = undefined;
    apercu.hidden = true;
    infoPochette.textContent = '';
    if (adresseApercu !== undefined) URL.revokeObjectURL(adresseApercu);
    if (fichier === undefined) return;
    preparerPochette(fichier)
      .then((prete) => {
        pochette = prete;
        adresseApercu = URL.createObjectURL(prete.blob);
        apercu.src = adresseApercu;
        apercu.hidden = false;
        infoPochette.textContent = tv('admin.nouvelle.pochette_prete', {
          largeur: prete.largeur,
          hauteur: prete.hauteur,
          taille: formaterTaille(prete.blob.size, langue),
        });
      })
      .catch(() => {
        saisiePochette.value = '';
        infoPochette.textContent = t('admin.nouvelle.err_image');
      });
  });

  const lireFormulaire = (): FormulairePiste => ({
    titre: titreSaisie.value,
    artiste: artisteSaisie.value,
    description: descriptionSaisie.value,
    categorie:
      categorieSelect.value === NOUVELLE_CATEGORIE ? categorieNom.value : categorieSelect.value,
    hashtags: hashtagsSaisie.value,
    date: dateSaisie.value,
    visible: casePublier.checked,
    telechargement: caseTelechargement.checked,
    licence: licenceSaisie.value,
    copyright: copyrightSaisie.value,
  });

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (envoiEnCours) return;
    erreurs.textContent = '';
    for (const controle of Object.values(controles)) controle.removeAttribute('aria-invalid');

    const donnees = lireFormulaire();
    const problemes = verifierFormulaire(donnees, mp3 !== undefined, depot);
    if (problemes.length > 0) {
      const messages = problemes.map((p) => {
        const cle = {
          fichier: 'admin.nouvelle.err_fichier',
          titre: 'admin.nouvelle.err_titre',
          categorie: 'admin.nouvelle.err_categorie',
          date: 'admin.nouvelle.err_date',
          doublon: 'admin.nouvelle.err_doublon',
        } as const;
        return tv(cle[p.champ], { id: p.id ?? '' });
      });
      for (const p of problemes) controles[p.champ].setAttribute('aria-invalid', 'true');
      erreurs.replaceChildren(...messages.map((m) => element('p', undefined, m)));
      controles[problemes[0]?.champ ?? 'titre'].focus();
      return;
    }
    if (mp3 === undefined) return;
    void publier(mp3, donnees);
  });

  async function publier(fichier: File, donnees: FormulairePiste): Promise<void> {
    envoiEnCours = true;
    enregistrer.disabled = true;
    progression.hidden = false;
    progression.value = 0;
    etatEnvoi.textContent = tv('admin.nouvelle.envoi_pourcent', { n: 0 });
    try {
      const categorie = dossierCategorie(donnees.categorie, depot.categories);
      const base = nomFichierPiste(donnees.titre);
      const chemins = cheminsPiste(categorie, base);
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
      await espace.client.commit(message, changements, (avancement) => {
        const pourcent =
          avancement.totalOctets === 0
            ? 100
            : Math.round((avancement.octets / avancement.totalOctets) * 100);
        progression.value = pourcent;
        etatEnvoi.textContent = tv('admin.nouvelle.envoi_pourcent', { n: pourcent });
      });
      progression.value = 100;
      oublierModifications();
      espace.invalider();
      const succes = donnees.visible
        ? t('admin.nouvelle.ok_publie')
        : t('admin.nouvelle.ok_brouillon');
      etatEnvoi.textContent = succes;
      annoncer(succes);
      apresPublication(succes);
    } catch (erreur) {
      etatEnvoi.textContent = '';
      progression.hidden = true;
      erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
    } finally {
      envoiEnCours = false;
      enregistrer.disabled = false;
    }
  }

  return f;
}
