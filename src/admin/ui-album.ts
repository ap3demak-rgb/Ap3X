// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { TYPES_ALBUM, type TypeAlbum } from '../catalogue/schemas';
import { deduireTypeAlbum, normaliserDate } from '../catalogue/texte';
import { t, tv } from '../i18n';
import { annoncer } from '../ui/annonceur';
import {
  formulaireAlbumVide,
  formulaireDepuisAlbum,
  pistesDepuisAlbum,
  planAlbum,
  type ErreurAlbum,
  type FormulaireAlbum,
  type PisteAlbum,
} from './album';
import { construireApercuAlbum } from './apercu';
import { creerChampCategorie, creerChampPochette } from './champs-communs';
import type { AlbumDepot } from './depot';
import { champ, element } from './dom';
import { creerEditeurPistes, type LignePisteUI } from './editeur-pistes';
import type { FicheBrute } from './edition';
import type { DepotAnalyse, Espace } from './espace';
import { DEPOT } from './github';
import type { TagsId3 } from './id3';
import { EnvoiParLots } from './lots';
import { messageErreur } from './messages';
import { creerProgression } from './progression';
import { surveillerModifications } from './sortie';

interface Existant {
  album: AlbumDepot;
  fiche: FicheBrute;
  fichesPistes: Map<string, FicheBrute | undefined>;
}

function adresseBrute(chemin: string): string {
  const segments = chemin.split('/').map(encodeURIComponent).join('/');
  return `https://raw.githubusercontent.com/${DEPOT.proprietaire}/${DEPOT.nom}/${DEPOT.branche}/${segments}`;
}

/** Formulaire de création d'un album : plusieurs MP3, ordre des pistes, pochette, brouillon ou publication. */
export function construireNouvelAlbum(
  espace: Espace,
  apres: (message: string) => void,
): HTMLElement {
  return coque(t('admin.album.titre_nouveau'), espace, async () => {
    const depot = await espace.depot();
    return formulaire(espace, depot, undefined, (message) => apres(message ?? ''));
  });
}

/** Formulaire de modification d'un album existant. `apres` reçoit un message de succès, ou rien si on annule. */
export function construireEditionAlbum(
  espace: Espace,
  album: AlbumDepot,
  apres: (message?: string) => void,
): HTMLElement {
  return coque(t('admin.album.titre_edition'), espace, async () => {
    const [depot, fiche, fichesPistes] = await Promise.all([
      espace.depot(),
      espace.ficheAlbum(album),
      espace.fichesDe(album.pistes),
    ]);
    return formulaire(espace, depot, { album, fiche, fichesPistes }, apres);
  });
}

/** Section avec son titre ; le formulaire est ajouté quand le dépôt est chargé. */
function coque(
  titre: string,
  _espace: Espace,
  construire: () => Promise<HTMLElement>,
): HTMLElement {
  const racine = element('section');
  racine.setAttribute('aria-labelledby', 'admin-album-titre');
  const entete = element('h2', undefined, titre);
  entete.id = 'admin-album-titre';
  const chargement = element('p', 'carte-meta', t('admin.liste.chargement'));
  chargement.setAttribute('role', 'status');
  racine.append(entete, chargement);
  construire()
    .then((contenu) => {
      chargement.remove();
      racine.append(contenu);
    })
    .catch((erreur: unknown) => {
      chargement.setAttribute('role', 'alert');
      chargement.textContent = messageErreur(erreur);
    });
  return racine;
}

function libelleErreur(erreur: ErreurAlbum): string {
  switch (erreur.champ) {
    case 'titre':
      return t('admin.nouvelle.err_titre');
    case 'categorie':
      return t('admin.nouvelle.err_categorie');
    case 'date':
      return t('admin.nouvelle.err_date');
    case 'doublon':
      return tv('admin.album.err_doublon', { id: erreur.id ?? '' });
    case 'pistes':
      return t('admin.album.err_pistes');
    case 'titre_piste':
      return t('admin.album.err_titre_piste');
    case 'disque':
      return t('admin.album.err_disque');
    case 'pochette':
      return t('admin.album.err_pochette');
    case 'retrait':
      return tv('admin.album.err_retrait', { id: erreur.id ?? '' });
    case 'deplacement':
    case 'album':
      return t('admin.album.err_deplacement');
  }
}

function formulaire(
  espace: Espace,
  depot: DepotAnalyse,
  existant: Existant | undefined,
  apres: (message?: string) => void,
): HTMLFormElement {
  const f = element('form', 'admin-formulaire');
  f.noValidate = true;
  const modifications = surveillerModifications(f);
  const champs = element('fieldset', 'admin-champs');

  // --- Champs de l'album -----------------------------------------------------------------------
  const titre = element('input');
  titre.type = 'text';
  titre.required = true;
  const artiste = element('input');
  artiste.type = 'text';
  const type = element('select');
  const date = element('input');
  date.type = 'text';
  date.placeholder = 'YYYY-MM-DD';
  date.inputMode = 'numeric';
  const description = element('textarea');
  description.rows = 4;
  const categorie = creerChampCategorie(depot);
  const hashtags = element('input');
  hashtags.type = 'text';
  hashtags.placeholder = '#ambient #nuit';
  const licence = element('input');
  licence.type = 'text';
  const copyright = element('input');
  copyright.type = 'text';
  const reference = element('input');
  reference.type = 'text';
  const telechargement = element('input');
  telechargement.type = 'checkbox';
  const publier = element('input');
  publier.type = 'checkbox';
  const caseEtiquette = (libelle: string, controle: HTMLInputElement): HTMLLabelElement => {
    const etiquette = element('label', 'champ-case');
    etiquette.append(controle, element('span', undefined, libelle));
    return etiquette;
  };
  const pochette = creerChampPochette();

  // Pochette actuelle d'un album existant.
  let pochetteActuelle: string | undefined;
  if (existant !== undefined) {
    const declaree =
      typeof existant.fiche['pochette'] === 'string' ? existant.fiche['pochette'] : '';
    const image =
      existant.album.images.find((i) => i.chemin.endsWith(`/${declaree}`) && declaree !== '') ??
      existant.album.images.find((i) => /\/(cover|pochette)\.[a-z]+$/i.test(i.chemin));
    if (image !== undefined) pochetteActuelle = adresseBrute(image.chemin);
  }

  // --- Éditeur de pistes -----------------------------------------------------------------------
  const valeursVides = formulaireAlbumVide();
  const mettreAJourTypeAuto = (): void => {
    const suggere = deduireTypeAlbum(Math.max(1, editeur.lignes().length));
    const auto = type.options[0];
    if (auto !== undefined) {
      auto.text = tv('admin.album.type_auto', { type: t(`type.${suggere}`) });
    }
  };
  const editeur = creerEditeurPistes({
    depot,
    espace,
    artisteAlbum: () => artiste.value.trim() || valeursVides.artiste,
    surChangement: () => {
      modifications.marquer();
      mettreAJourTypeAuto();
    },
    surTags: (tags: TagsId3, fichier: File) => {
      // Création : le premier fichier ajouté préremplit les champs encore vides de l'album.
      if (existant !== undefined) return;
      let rempli = false;
      const remplir = (saisie: HTMLInputElement | HTMLTextAreaElement, valeur?: string): void => {
        if (valeur === undefined || valeur === '' || saisie.value.trim() !== '') return;
        saisie.value = valeur;
        rempli = true;
      };
      remplir(titre, tags.album);
      remplir(artiste, tags.artiste);
      remplir(date, tags.date === undefined ? undefined : normaliserDate(tags.date));
      if (categorie.lire() === '' && tags.genre !== undefined) {
        const genre = tags.genre.toLowerCase();
        const dossier = depot.categories.find((d) => d.toLowerCase() === genre);
        if (dossier !== undefined) {
          categorie.ecrire(dossier);
          rempli = true;
        }
      }
      if (pochette.pochette() === undefined && tags.pochette !== undefined) {
        void pochette
          .definir(
            new Blob([new Uint8Array(tags.pochette.donnees)], { type: tags.pochette.type }),
            tv('admin.album.cover_id3', { nom: fichier.name }),
          )
          .then((ok) => {
            if (ok) rempli = true;
          });
      }
      if (rempli) annoncer(t('admin.nouvelle.tags_lus'));
    },
  });

  type.append(new Option('', ''));
  for (const valeur of TYPES_ALBUM) type.append(new Option(t(`type.${valeur}`), valeur));
  mettreAJourTypeAuto();

  // --- Valeurs initiales -----------------------------------------------------------------------
  const ecrire = (v: FormulaireAlbum): void => {
    titre.value = v.titre;
    artiste.value = v.artiste;
    type.value = v.type;
    date.value = v.date;
    description.value = v.description;
    categorie.ecrire(v.categorie);
    hashtags.value = v.hashtags;
    licence.value = v.licence;
    copyright.value = v.copyright;
    reference.value = v.reference;
    telechargement.checked = v.telechargement;
    publier.checked = v.visible;
  };
  const lire = (): FormulaireAlbum => ({
    titre: titre.value,
    artiste: artiste.value,
    type: type.value as FormulaireAlbum['type'],
    date: date.value,
    description: description.value,
    categorie: categorie.lire(),
    hashtags: hashtags.value,
    licence: licence.value,
    copyright: copyright.value,
    reference: reference.value,
    visible: publier.checked,
    telechargement: telechargement.checked,
  });
  if (existant === undefined) {
    ecrire(formulaireAlbumVide());
  } else {
    ecrire(formulaireDepuisAlbum(existant.album, existant.fiche));
    const pistes = pistesDepuisAlbum(existant.album, existant.fiche, existant.fichesPistes);
    editeur.definir(
      pistes.map((p): LignePisteUI => ({
        cle: p.cle,
        titre: p.titre,
        artiste: p.artiste,
        disque: p.disque,
        source: {
          type: 'existante',
          piste: (p.origine as Extract<PisteAlbum['origine'], { type: 'existante' }>).piste,
          fiche: (p.origine as Extract<PisteAlbum['origine'], { type: 'existante' }>).fiche,
        },
      })),
    );
    mettreAJourTypeAuto();
  }

  // --- Aperçu de la page publique --------------------------------------------------------------
  const boutonApercu = element('button', 'bouton', t('admin.apercu.bouton'));
  boutonApercu.type = 'button';
  boutonApercu.setAttribute('aria-expanded', 'false');
  const zoneApercu = element('div');
  zoneApercu.hidden = true;
  const actualiserApercu = (): void => {
    const v = lire();
    const lignes = editeur.lignes();
    const typeAffiche =
      v.type === ''
        ? t(`type.${deduireTypeAlbum(Math.max(1, lignes.length))}`)
        : t(`type.${v.type as TypeAlbum}`);
    const adresse = pochette.adresse() ?? pochetteActuelle;
    zoneApercu.replaceChildren(
      construireApercuAlbum({
        titre: v.titre,
        artiste: v.artiste,
        type: typeAffiche,
        date: v.date,
        description: v.description,
        hashtags: v.hashtags,
        categorie: v.categorie,
        licence: v.licence,
        visible: v.visible,
        pistes: lignes.map((l) => ({
          titre: l.titre,
          artiste: l.artiste,
          disque: l.disque,
          ...(l.duree !== undefined && { duree: l.duree }),
        })),
        ...(adresse !== undefined && { pochette: adresse }),
      }),
    );
  };
  boutonApercu.addEventListener('click', () => {
    const ouvert = boutonApercu.getAttribute('aria-expanded') === 'true';
    boutonApercu.setAttribute('aria-expanded', String(!ouvert));
    zoneApercu.hidden = ouvert;
    if (!ouvert) actualiserApercu();
  });

  // --- Assemblage ------------------------------------------------------------------------------
  const erreurs = element('div', 'erreur-champ');
  erreurs.setAttribute('role', 'alert');
  const progression = creerProgression();
  const enregistrer = element(
    'button',
    'bouton bouton-principal',
    existant === undefined ? t('admin.album.enregistrer') : t('admin.edition.enregistrer'),
  );
  enregistrer.type = 'submit';
  const reprendre = element('button', 'bouton bouton-principal', t('admin.album.reprendre'));
  reprendre.type = 'button';
  reprendre.hidden = true;
  const annuler = element('button', 'bouton', t('admin.edition.annuler'));
  annuler.type = 'button';
  annuler.hidden = existant === undefined;
  annuler.addEventListener('click', () => {
    modifications.oublier();
    apres();
  });
  const infoReprise = element('p', 'carte-meta');
  infoReprise.setAttribute('role', 'status');
  const actions = element('div', 'admin-actions');
  actions.append(enregistrer, reprendre, annuler);

  champs.append(
    champ(t('admin.album.champ_titre'), titre),
    champ(t('admin.album.artiste'), artiste),
    champ(t('admin.album.type'), type),
    champ(t('admin.nouvelle.date'), date),
    champ(t('admin.nouvelle.description'), description),
    ...categorie.elements,
    champ(t('admin.nouvelle.hashtags'), hashtags),
    champ(t('admin.nouvelle.licence'), licence),
    champ(t('admin.nouvelle.copyright'), copyright),
    champ(t('admin.album.reference'), reference),
    caseEtiquette(t('admin.nouvelle.telechargement'), telechargement),
    caseEtiquette(t('admin.nouvelle.publier'), publier),
    ...pochette.elements,
  );
  const sectionPistes = element('section');
  sectionPistes.append(element('h3', undefined, t('admin.album.pistes')), editeur.element);
  if (existant !== undefined) {
    sectionPistes.append(element('p', 'carte-meta', t('admin.album.retrait_note')));
  }
  champs.append(sectionPistes, boutonApercu, zoneApercu);
  f.append(champs, actions, infoReprise, progression.element, erreurs);

  const controle = (erreur: ErreurAlbum): HTMLElement | null => {
    switch (erreur.champ) {
      case 'titre':
        return titre;
      case 'categorie':
        return categorie.select;
      case 'date':
        return date;
      case 'pochette':
        return pochette.input;
      case 'titre_piste':
      case 'disque':
        return editeur.element.querySelector<HTMLElement>(
          `[data-cle="${CSS.escape(erreur.cles?.[0] ?? '')}"] input`,
        );
      default:
        return null;
    }
  };

  // --- Envoi -----------------------------------------------------------------------------------
  let envoi: EnvoiParLots | undefined;
  let succes = '';
  let occupe = false;

  const finir = (): void => {
    modifications.oublier();
    espace.invalider();
    progression.terminer(succes);
    annoncer(succes);
    apres(succes);
  };

  async function lancer(): Promise<void> {
    if (envoi === undefined || occupe) return;
    occupe = true;
    enregistrer.disabled = true;
    reprendre.disabled = true;
    erreurs.textContent = '';
    progression.demarrer();
    try {
      await envoi.envoyer((avancement) => progression.mettreAJourLots(avancement));
      finir();
    } catch (erreur) {
      progression.terminer();
      erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
      if (envoi.termines > 0) {
        // Une partie est déjà publiée : on fige le formulaire et on propose de reprendre là où ça s'est arrêté.
        champs.disabled = true;
        enregistrer.hidden = true;
        reprendre.hidden = false;
        infoReprise.textContent = tv('admin.album.reprise_info', {
          i: envoi.termines,
          total: envoi.total,
        });
      } else {
        envoi = undefined;
      }
    } finally {
      occupe = false;
      enregistrer.disabled = false;
      reprendre.disabled = false;
    }
  }

  reprendre.addEventListener('click', () => void lancer());

  f.addEventListener('submit', (evenement) => {
    evenement.preventDefault();
    if (occupe || envoi !== undefined) return;
    void preparer();
  });

  async function preparer(): Promise<void> {
    erreurs.textContent = '';
    for (const c of [titre, categorie.select, date, pochette.input])
      c.removeAttribute('aria-invalid');
    occupe = true;
    enregistrer.disabled = true;
    try {
      const formulaireSaisi = lire();
      const pistes: PisteAlbum[] = await Promise.all(
        editeur.lignes().map(async (ligne): Promise<PisteAlbum> => {
          const base = {
            cle: ligne.cle,
            titre: ligne.titre,
            artiste: ligne.artiste,
            disque: ligne.disque,
          };
          if (ligne.source.type === 'fichier') {
            return {
              ...base,
              origine: {
                type: 'nouvelle',
                octets: new Uint8Array(await ligne.source.fichier.arrayBuffer()),
              },
            };
          }
          return { ...base, origine: ligne.source };
        }),
      );
      const nouvelle = pochette.pochette();
      const plan = planAlbum({
        formulaire: formulaireSaisi,
        pistes,
        ...(nouvelle !== undefined && {
          pochette: {
            octets: new Uint8Array(await nouvelle.blob.arrayBuffer()),
            extension: nouvelle.extension,
          },
        }),
        ...(existant !== undefined && { existant }),
        depot,
      });
      if (!plan.ok) {
        for (const e of plan.erreurs) controle(e)?.setAttribute('aria-invalid', 'true');
        erreurs.replaceChildren(
          ...plan.erreurs.map((e) => element('p', undefined, libelleErreur(e))),
        );
        const premier = plan.erreurs.map(controle).find((c) => c !== null);
        premier?.focus();
        return;
      }
      if (plan.lots.length === 0) {
        erreurs.replaceChildren(element('p', undefined, t('admin.edition.rien')));
        return;
      }
      succes =
        existant !== undefined
          ? t('admin.edition.ok')
          : formulaireSaisi.visible
            ? t('admin.album.ok_publie')
            : t('admin.album.ok_brouillon');
      envoi = new EnvoiParLots(espace.client, plan.lots);
    } catch (erreur) {
      erreurs.replaceChildren(element('p', undefined, messageErreur(erreur)));
      return;
    } finally {
      occupe = false;
      enregistrer.disabled = false;
    }
    await lancer();
  }

  return f;
}
