// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { pochetteReduite } from '../catalogue/pochettes';
import type { Album } from '../catalogue/schemas';
import { urlDuFichier } from '../catalogue/charger';
import { t } from '../i18n';
import { formaterDuree } from '../i18n/format';
import { changerIcone, icone, type NomIcone } from './icones';
import type { Lecteur, Repetition } from './lecteur';

export type RechercheAlbum = (id: string) => Album | undefined;

function bouton(classe: string, nomIcone: NomIcone): HTMLButtonElement {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = classe;
  b.append(icone(nomIcone));
  return b;
}

function curseur(classe: string, min: number, max: number, pas: number): HTMLInputElement {
  const c = document.createElement('input');
  c.type = 'range';
  c.className = classe;
  c.min = String(min);
  c.max = String(max);
  c.step = String(pas);
  c.value = '0';
  return c;
}

function texte(balise: string, classe: string): HTMLElement {
  const e = document.createElement(balise);
  e.className = classe;
  return e;
}

/** Libellé « 3/12 – Nom de l'album » d'une piste appartenant à un album. */
export function libelleAlbum(album: Album | undefined, idPiste: string): string | undefined {
  if (album === undefined) return undefined;
  const rang = album.pistes.indexOf(idPiste) + 1;
  return rang > 0 ? `${rang}/${album.nombrePistes} – ${album.titre}` : album.titre;
}

const ICONE_REPETITION: Record<Repetition, NomIcone> = {
  aucune: 'repetition',
  liste: 'repetition',
  piste: 'repetitionPiste',
};

/**
 * Construit la barre de lecture fixe. Les éléments sont créés une fois ; les événements du lecteur
 * ne font que mettre à jour leurs valeurs, pour ne pas perturber le focus ni le glissement des curseurs.
 */
export interface Barre {
  element: HTMLElement;
  /** Retire les écouteurs posés sur le lecteur (avant de reconstruire la barre). */
  detruire: () => void;
}

export function creerBarre(lecteur: Lecteur, chercherAlbum: RechercheAlbum): Barre {
  const racine = document.createElement('section');
  racine.className = 'lecteur';
  racine.setAttribute('aria-label', t('lecteur.nom'));

  // Informations sur la piste
  const info = texte('div', 'lecteur-info');
  const pochette = document.createElement('img');
  pochette.className = 'lecteur-pochette';
  pochette.alt = '';
  pochette.width = 56;
  pochette.height = 56;
  pochette.loading = 'lazy';
  pochette.hidden = true;
  const textes = texte('div', 'lecteur-textes');
  const titre = texte('p', 'lecteur-titre');
  const detail = texte('p', 'lecteur-detail');
  const erreur = texte('p', 'lecteur-erreur');
  erreur.setAttribute('role', 'alert');
  textes.append(titre, detail, erreur);
  info.append(pochette, textes);

  // Commandes de lecture
  const commandes = texte('div', 'lecteur-commandes');
  const aleatoire = bouton('lecteur-bouton', 'aleatoire');
  const precedent = bouton('lecteur-bouton', 'precedent');
  const lecture = bouton('lecteur-bouton lecteur-lecture', 'lecture');
  lecture.setAttribute('aria-keyshortcuts', 'Space');
  const suivant = bouton('lecteur-bouton', 'suivant');
  const repetition = bouton('lecteur-bouton', 'repetition');
  commandes.append(aleatoire, precedent, lecture, suivant, repetition);

  // Progression
  const progression = texte('div', 'lecteur-progression');
  const tempsCourant = texte('span', 'lecteur-temps');
  const position = curseur('lecteur-curseur', 0, 0, 1);
  const tempsTotal = texte('span', 'lecteur-temps');
  position.setAttribute('aria-label', t('lecteur.position'));
  progression.append(tempsCourant, position, tempsTotal);

  // Volume et file d'attente
  const reglages = texte('div', 'lecteur-reglages');
  const muet = bouton('lecteur-bouton', 'volume');
  muet.setAttribute('aria-keyshortcuts', 'M');
  const volume = curseur('lecteur-curseur lecteur-volume', 0, 1, 0.01);
  volume.setAttribute('aria-label', t('lecteur.volume'));
  const boutonFile = bouton('lecteur-bouton', 'file');
  boutonFile.setAttribute('aria-label', t('lecteur.file'));
  boutonFile.setAttribute('aria-expanded', 'false');
  boutonFile.setAttribute('aria-controls', 'lecteur-file');
  reglages.append(muet, volume, boutonFile);

  // File d'attente
  const panneau = texte('div', 'lecteur-file');
  panneau.id = 'lecteur-file';
  panneau.hidden = true;
  const titreFile = document.createElement('h2');
  titreFile.textContent = t('lecteur.file');
  const liste = document.createElement('ul');
  const fileVide = texte('p', 'lecteur-file-vide');
  fileVide.textContent = t('lecteur.file.vide');
  panneau.append(titreFile, liste, fileVide);

  // Annonce aux lecteurs d'écran
  const annonce = texte('div', 'visuellement-cache');
  annonce.setAttribute('role', 'status');
  annonce.setAttribute('aria-live', 'polite');

  racine.append(info, commandes, progression, reglages, panneau, annonce);

  // Libellés dépendant de la langue
  lecture.setAttribute('aria-label', t('lecteur.lecture'));
  precedent.setAttribute('aria-label', t('lecteur.precedent'));
  suivant.setAttribute('aria-label', t('lecteur.suivant'));
  aleatoire.setAttribute('aria-label', t('lecteur.aleatoire'));

  let glissement = false;

  function afficherFile(): void {
    const etat = lecteur.etat();
    titreFile.textContent = t('lecteur.file');
    liste.replaceChildren();
    fileVide.hidden = etat.file.length > 0;
    etat.file.forEach((piste, index) => {
      const ligne = document.createElement('li');
      if (index === etat.index) ligne.setAttribute('aria-current', 'true');
      const jouer = document.createElement('button');
      jouer.type = 'button';
      jouer.className = 'lecteur-file-titre';
      jouer.textContent = `${piste.titre} – ${piste.artiste}`;
      jouer.setAttribute(
        'aria-label',
        `${t('lecteur.lecture')} : ${piste.titre} – ${piste.artiste}`,
      );
      jouer.addEventListener('click', () => lecteur.jouerIndex(index));
      ligne.append(jouer);

      const action = (
        nom: NomIcone,
        cle: Parameters<typeof t>[0],
        fn: () => void,
        actif: boolean,
      ) => {
        const b = bouton('lecteur-bouton', nom);
        b.setAttribute('aria-label', `${t(cle)} : ${piste.titre}`);
        b.disabled = !actif;
        b.addEventListener('click', fn);
        ligne.append(b);
      };
      action('monter', 'lecteur.monter', () => lecteur.deplacer(index, index - 1), index > 0);
      action(
        'descendre',
        'lecteur.descendre',
        () => lecteur.deplacer(index, index + 1),
        index < etat.file.length - 1,
      );
      action('retirer', 'lecteur.retirer', () => lecteur.retirer(index), true);
      liste.append(ligne);
    });
  }

  function afficherPiste(): void {
    const { piste } = lecteur.etat();
    if (piste === undefined) {
      titre.textContent = t('lecteur.rien');
      detail.textContent = '';
      pochette.hidden = true;
      pochette.removeAttribute('src');
      annonce.textContent = '';
      return;
    }
    titre.textContent = piste.titre;
    const album = piste.album !== undefined ? chercherAlbum(piste.album) : undefined;
    const rang = libelleAlbum(album, piste.id);
    detail.textContent = rang === undefined ? piste.artiste : `${piste.artiste} · ${rang}`;
    const miniature = pochetteReduite(piste);
    if (miniature !== undefined) {
      pochette.src = urlDuFichier(miniature);
      pochette.hidden = false;
    } else {
      pochette.hidden = true;
      pochette.removeAttribute('src');
    }
    annonce.textContent = `${t('lecteur.en_cours')} : ${piste.titre} – ${piste.artiste}`;
  }

  function actualiser(): void {
    const etat = lecteur.etat();
    const aUnePiste = etat.piste !== undefined;

    changerIcone(lecture, etat.enLecture ? 'pause' : 'lecture');
    lecture.setAttribute('aria-label', etat.enLecture ? t('lecteur.pause') : t('lecteur.lecture'));
    for (const b of [lecture, precedent, suivant, aleatoire, repetition]) b.disabled = !aUnePiste;

    aleatoire.setAttribute('aria-pressed', String(etat.aleatoire));
    aleatoire.classList.toggle('actif', etat.aleatoire);
    changerIcone(repetition, ICONE_REPETITION[etat.repetition]);
    repetition.setAttribute('aria-label', t(`lecteur.repetition.${etat.repetition}`));
    repetition.classList.toggle('actif', etat.repetition !== 'aucune');

    const duree = etat.duree;
    const courant = Math.min(etat.position, duree || etat.position);
    tempsCourant.textContent = formaterDuree(courant);
    tempsTotal.textContent = formaterDuree(duree);
    position.max = String(Math.max(duree, 0));
    position.disabled = !aUnePiste;
    if (!glissement) position.value = String(courant);
    position.setAttribute('aria-valuetext', `${formaterDuree(courant)} / ${formaterDuree(duree)}`);

    const sonCoupe = etat.muet || etat.volume === 0;
    changerIcone(muet, sonCoupe ? 'muet' : 'volume');
    muet.setAttribute('aria-label', sonCoupe ? t('lecteur.activer') : t('lecteur.couper'));
    volume.value = String(etat.muet ? 0 : etat.volume);
    volume.setAttribute(
      'aria-valuetext',
      new Intl.NumberFormat(document.documentElement.lang, { style: 'percent' }).format(
        etat.muet ? 0 : etat.volume,
      ),
    );

    erreur.textContent = etat.erreur
      ? t(etat.erreurReseau ? 'lecteur.erreur_reseau' : 'lecteur.erreur')
      : '';
  }

  // Interactions
  lecture.addEventListener('click', () => lecteur.basculer());
  precedent.addEventListener('click', () => lecteur.precedent());
  suivant.addEventListener('click', () => lecteur.suivant());
  aleatoire.addEventListener('click', () => lecteur.basculerAleatoire());
  repetition.addEventListener('click', () => lecteur.cyclerRepetition());
  muet.addEventListener('click', () => lecteur.basculerMuet());
  volume.addEventListener('input', () => lecteur.definirVolume(Number(volume.value)));
  position.addEventListener('pointerdown', () => {
    glissement = true;
  });
  position.addEventListener('input', () => lecteur.aller(Number(position.value)));
  const finGlissement = (): void => {
    glissement = false;
    actualiser();
  };
  position.addEventListener('pointerup', finGlissement);
  position.addEventListener('pointercancel', finGlissement);
  boutonFile.addEventListener('click', () => {
    const ouvert = panneau.hidden;
    panneau.hidden = !ouvert;
    boutonFile.setAttribute('aria-expanded', String(ouvert));
  });
  panneau.addEventListener('keydown', (evenement) => {
    if (evenement.key === 'Escape') {
      panneau.hidden = true;
      boutonFile.setAttribute('aria-expanded', 'false');
      boutonFile.focus();
    }
  });

  const surPiste = (): void => {
    afficherPiste();
    afficherFile();
  };
  lecteur.addEventListener('etat', actualiser);
  lecteur.addEventListener('piste', surPiste);
  lecteur.addEventListener('file', afficherFile);

  actualiser();
  afficherPiste();
  afficherFile();
  return {
    element: racine,
    detruire: () => {
      lecteur.removeEventListener('etat', actualiser);
      lecteur.removeEventListener('piste', surPiste);
      lecteur.removeEventListener('file', afficherFile);
    },
  };
}
