// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { formaterDuree } from '../i18n/format';
import { annoncer } from '../ui/annonceur';
import { champ, element } from './dom';
import type { PisteDepot } from './depot';
import type { FicheBrute } from './edition';
import type { DepotAnalyse, Espace } from './espace';
import { lireTagsFichier, type TagsId3 } from './id3';
import { messageErreur } from './messages';

/** Une ligne de l'éditeur : une piste de l'album telle que l'utilisateur la voit et la modifie. */
export interface LignePisteUI {
  cle: string;
  titre: string;
  artiste: string;
  disque: number;
  source:
    | { type: 'fichier'; fichier: File }
    | { type: 'existante'; piste: PisteDepot; fiche: FicheBrute | undefined }
    | { type: 'publiee'; piste: PisteDepot; fiche: FicheBrute | undefined };
  /** Durée en secondes, connue pour les fichiers ajoutés dans cette session. */
  duree?: number;
}

export interface OptionsEditeur {
  depot: DepotAnalyse;
  espace: Espace;
  /** Artiste de l'album, pour ne pas répéter l'artiste des pistes qui le partagent. */
  artisteAlbum: () => string;
  /** Appelé après toute modification (ajout, retrait, ordre, saisie). */
  surChangement: () => void;
  /** Appelé avec les tags du premier fichier ajouté, pour préremplir l'album. */
  surTags: (tags: TagsId3, fichier: File) => void;
}

export interface EditeurPistes {
  element: HTMLElement;
  lignes(): LignePisteUI[];
  definir(lignes: LignePisteUI[]): void;
  /** Nombre de pistes et durée totale (connue seulement si toutes les durées le sont). */
  resume(): { pistes: number; duree: number | undefined };
}

const estMp3 = (fichier: File): boolean =>
  fichier.name.toLowerCase().endsWith('.mp3') || fichier.type === 'audio/mpeg';

/** Durée d'un fichier audio, lue dans ses métadonnées ; `undefined` si le navigateur ne la lit pas. */
function mesurerDuree(fichier: File): Promise<number | undefined> {
  return new Promise((resoudre) => {
    const audio = new Audio();
    const adresse = URL.createObjectURL(fichier);
    const fin = (duree: number | undefined): void => {
      URL.revokeObjectURL(adresse);
      resoudre(duree);
    };
    audio.preload = 'metadata';
    audio.addEventListener('loadedmetadata', () =>
      fin(Number.isFinite(audio.duration) ? audio.duration : undefined),
    );
    audio.addEventListener('error', () => fin(undefined));
    audio.src = adresse;
  });
}

/**
 * Éditeur des pistes d'un album : ajout de plusieurs MP3 (sélection ou glisser-déposer), ajout d'un titre
 * déjà publié, titre, artiste et disque de chaque piste, réordonnancement (boutons ou glisser-déposer),
 * retrait. Les pistes sont groupées par disque ; la numérotation suit l'ordre affiché.
 */
export function creerEditeurPistes(options: OptionsEditeur): EditeurPistes {
  const racine = element('div', 'admin-editeur-pistes');
  let lignes: LignePisteUI[] = [];
  let compteur = 0;

  // --- Ajout de fichiers -----------------------------------------------------------------------
  const zone = element('div', 'admin-depot');
  const saisie = element('input');
  saisie.type = 'file';
  saisie.accept = 'audio/mpeg,.mp3';
  saisie.multiple = true;
  const retourAjout = element('p', 'erreur-champ');
  retourAjout.setAttribute('role', 'alert');
  zone.append(
    champ(t('admin.album.ajouter_fichiers'), saisie),
    element('p', 'carte-meta', t('admin.album.glisser')),
    retourAjout,
  );

  // --- Ajout d'un titre déjà publié ------------------------------------------------------------
  const choixPubliee = element('select');
  const boutonPubliee = element('button', 'bouton', t('admin.album.ajouter'));
  boutonPubliee.type = 'button';
  const ligneAjoutPubliee = element('div', 'formulaire-ligne');
  ligneAjoutPubliee.append(champ(t('admin.album.ajouter_publiee'), choixPubliee), boutonPubliee);

  const resume = element('p', 'carte-meta');
  resume.setAttribute('role', 'status');
  const liste = element('ol', 'admin-pistes-album');
  racine.append(zone, ligneAjoutPubliee, resume, liste);

  const resumeActuel = (): { pistes: number; duree: number | undefined } => {
    const connues = lignes.every((l) => l.duree !== undefined);
    return {
      pistes: lignes.length,
      duree:
        connues && lignes.length > 0
          ? lignes.reduce((somme, l) => somme + (l.duree ?? 0), 0)
          : undefined,
    };
  };

  const majResume = (): void => {
    const { pistes, duree } = resumeActuel();
    resume.textContent =
      duree === undefined
        ? tv('admin.album.resume', { n: pistes })
        : tv('admin.album.resume_duree', { n: pistes, duree: formaterDuree(duree) });
  };

  const majPubliees = (): void => {
    const prises = new Set(
      lignes.flatMap((l) => (l.source.type === 'fichier' ? [] : [l.source.piste.mp3.chemin])),
    );
    const candidates = options.depot.pistes.filter(
      (p) => p.album === undefined && !prises.has(p.mp3.chemin),
    );
    choixPubliee.replaceChildren(
      ...candidates.map((p) => new Option(`${p.categorie} / ${p.base}`, p.mp3.chemin)),
    );
    ligneAjoutPubliee.hidden = candidates.length === 0;
  };

  /** Regroupe par disque en gardant l'ordre saisi à l'intérieur de chaque disque. */
  const trier = (): void => {
    lignes = lignes
      .map((ligne, position) => ({ ligne, position }))
      .sort((a, b) => a.ligne.disque - b.ligne.disque || a.position - b.position)
      .map(({ ligne }) => ligne);
  };

  const changer = (): void => {
    majResume();
    options.surChangement();
  };

  /** Déplace une piste d'un cran dans son disque ; renvoie vrai si elle a bougé. */
  const deplacer = (cle: string, sens: -1 | 1): boolean => {
    const index = lignes.findIndex((l) => l.cle === cle);
    const cible = index + sens;
    const ligne = lignes[index];
    const voisine = lignes[cible];
    if (ligne === undefined || voisine === undefined || voisine.disque !== ligne.disque)
      return false;
    lignes[index] = voisine;
    lignes[cible] = ligne;
    return true;
  };

  function rendre(focus?: { cle: string; action: 'monter' | 'descendre' | 'titre' }): void {
    majPubliees();
    const numeros = new Map<number, number>();
    liste.replaceChildren(
      ...lignes.map((ligne, index) => {
        const numero = (numeros.get(ligne.disque) ?? 0) + 1;
        numeros.set(ligne.disque, numero);
        return elementPiste(ligne, index, numero);
      }),
    );
    majResume();
    if (focus !== undefined) {
      const ligne = liste.querySelector(`[data-cle="${CSS.escape(focus.cle)}"]`);
      const voulu = ligne?.querySelector<HTMLButtonElement | HTMLInputElement>(
        `[data-action="${focus.action}"]`,
      );
      // Un bouton devenu inactif (première ou dernière piste du disque) cède le focus à son vis-à-vis.
      const autre = ligne?.querySelector<HTMLButtonElement>(
        `[data-action="${focus.action === 'monter' ? 'descendre' : 'monter'}"]`,
      );
      (voulu?.disabled === true ? autre : voulu)?.focus();
    }
  }

  function elementPiste(ligne: LignePisteUI, index: number, numero: number): HTMLElement {
    const item = element('li', 'admin-piste-album');
    item.dataset['cle'] = ligne.cle;
    item.draggable = true;
    const position = index + 1;

    const etiquetteNumero = element(
      'span',
      'admin-numero',
      lignes.some((l) => l.disque !== 1) ? `${ligne.disque}.${numero}` : `${numero}.`,
    );
    const titre = element('input');
    titre.type = 'text';
    titre.value = ligne.titre;
    titre.dataset['action'] = 'titre';
    titre.setAttribute('aria-label', tv('admin.album.piste_titre', { n: position }));
    titre.addEventListener('input', () => {
      ligne.titre = titre.value;
      changer();
    });
    const artiste = element('input');
    artiste.type = 'text';
    artiste.value = ligne.artiste;
    artiste.placeholder = options.artisteAlbum();
    artiste.setAttribute('aria-label', tv('admin.album.piste_artiste', { n: position }));
    artiste.addEventListener('input', () => {
      ligne.artiste = artiste.value;
      changer();
    });
    const disque = element('input', 'admin-disque');
    disque.type = 'number';
    disque.min = '1';
    disque.step = '1';
    disque.value = String(ligne.disque);
    disque.setAttribute('aria-label', tv('admin.album.piste_disque', { n: position }));
    disque.addEventListener('change', () => {
      const valeur = Number.parseInt(disque.value, 10);
      ligne.disque = Number.isInteger(valeur) && valeur >= 1 ? valeur : 1;
      trier();
      rendre({ cle: ligne.cle, action: 'titre' });
      changer();
    });

    const duree = element(
      'span',
      'carte-meta admin-duree',
      ligne.duree === undefined ? '' : formaterDuree(ligne.duree),
    );

    const monter = element('button', 'bouton', '↑');
    monter.type = 'button';
    monter.dataset['action'] = 'monter';
    monter.setAttribute('aria-label', tv('admin.album.monter', { titre: ligne.titre }));
    const descendre = element('button', 'bouton', '↓');
    descendre.type = 'button';
    descendre.dataset['action'] = 'descendre';
    descendre.setAttribute('aria-label', tv('admin.album.descendre', { titre: ligne.titre }));
    const retirer = element('button', 'bouton', '✕');
    retirer.type = 'button';
    retirer.setAttribute('aria-label', tv('admin.album.retirer', { titre: ligne.titre }));
    const precedente = lignes[index - 1];
    const suivante = lignes[index + 1];
    monter.disabled = precedente === undefined || precedente.disque !== ligne.disque;
    descendre.disabled = suivante === undefined || suivante.disque !== ligne.disque;

    const bouger = (sens: -1 | 1, action: 'monter' | 'descendre'): void => {
      if (!deplacer(ligne.cle, sens)) return;
      const nouvelle = lignes.findIndex((l) => l.cle === ligne.cle) + 1;
      rendre({ cle: ligne.cle, action });
      annoncer(tv('admin.album.deplacee', { titre: ligne.titre, n: nouvelle }));
      changer();
    };
    monter.addEventListener('click', () => bouger(-1, 'monter'));
    descendre.addEventListener('click', () => bouger(1, 'descendre'));
    retirer.addEventListener('click', () => {
      const suivanteCle = (lignes[index + 1] ?? lignes[index - 1])?.cle;
      lignes = lignes.filter((l) => l.cle !== ligne.cle);
      rendre(suivanteCle === undefined ? undefined : { cle: suivanteCle, action: 'titre' });
      annoncer(tv('admin.album.retiree', { titre: ligne.titre }));
      changer();
    });

    // Glisser-déposer : alternative à la souris des boutons ↑ ↓ (qui restent la voie au clavier).
    item.addEventListener('dragstart', (evenement) => {
      evenement.dataTransfer?.setData('text/plain', ligne.cle);
      item.classList.add('glisse');
    });
    item.addEventListener('dragend', () => item.classList.remove('glisse'));
    item.addEventListener('dragover', (evenement) => {
      if (evenement.dataTransfer?.types.includes('text/plain') === true) evenement.preventDefault();
    });
    item.addEventListener('drop', (evenement) => {
      const origine = evenement.dataTransfer?.getData('text/plain');
      if (origine === undefined || origine === '' || origine === ligne.cle) return;
      evenement.preventDefault();
      evenement.stopPropagation();
      const deplacee = lignes.find((l) => l.cle === origine);
      if (deplacee === undefined || deplacee.disque !== ligne.disque) return;
      lignes = lignes.filter((l) => l.cle !== origine);
      lignes.splice(
        lignes.findIndex((l) => l.cle === ligne.cle),
        0,
        deplacee,
      );
      rendre();
      annoncer(
        tv('admin.album.deplacee', {
          titre: deplacee.titre,
          n: lignes.findIndex((l) => l.cle === origine) + 1,
        }),
      );
      changer();
    });

    const boutons = element('div', 'admin-actions');
    boutons.append(monter, descendre, retirer);
    item.append(etiquetteNumero, titre, artiste, disque, duree, boutons);
    return item;
  }

  // --- Ajout de fichiers MP3 -------------------------------------------------------------------
  async function ajouterFichiers(fichiers: File[]): Promise<void> {
    retourAjout.textContent = '';
    const valides = fichiers.filter(estMp3);
    if (valides.length < fichiers.length) retourAjout.textContent = t('admin.nouvelle.err_mp3');
    if (valides.length === 0) return;
    const lus = await Promise.all(
      valides.map(async (fichier) => ({
        fichier,
        tags: await lireTagsFichier(fichier).catch((): TagsId3 => ({})),
      })),
    );
    // Ordre : disque, puis numéro de piste du tag, puis nom de fichier (« 2 » avant « 10 »).
    lus.sort(
      (a, b) =>
        (a.tags.disque ?? 1) - (b.tags.disque ?? 1) ||
        (a.tags.numero ?? Number.MAX_SAFE_INTEGER) - (b.tags.numero ?? Number.MAX_SAFE_INTEGER) ||
        a.fichier.name.localeCompare(b.fichier.name, undefined, { numeric: true }),
    );
    // Les champs de l'album sont remplis avant les pistes, pour que l'artiste commun ne soit pas répété.
    // Pour chaque tag, la première valeur trouvée dans l'ordre des pistes l'emporte.
    const premier = lus[0];
    if (premier !== undefined && lignes.length === 0) {
      const fusion: TagsId3 = {};
      for (const { tags } of lus) {
        for (const [cle, valeur] of Object.entries(tags)) {
          if (!(cle in fusion)) Object.assign(fusion, { [cle]: valeur });
        }
      }
      options.surTags(fusion, premier.fichier);
    }
    const nouvelles: LignePisteUI[] = lus.map(({ fichier, tags }) => {
      compteur += 1;
      const artiste = tags.artiste ?? '';
      return {
        cle: `fichier-${compteur}`,
        titre: tags.titre ?? fichier.name.replace(/\.mp3$/i, ''),
        artiste: artiste !== '' && artiste !== options.artisteAlbum() ? artiste : '',
        disque: tags.disque ?? 1,
        source: { type: 'fichier', fichier },
      };
    });
    lignes = [...lignes, ...nouvelles];
    trier();
    rendre();
    changer();
    // Les durées arrivent une à une, sans bloquer l'interface.
    for (const ligne of nouvelles) {
      if (ligne.source.type !== 'fichier') continue;
      void mesurerDuree(ligne.source.fichier).then((duree) => {
        if (duree === undefined) return;
        ligne.duree = duree;
        const duo = liste.querySelector(`[data-cle="${CSS.escape(ligne.cle)}"] .admin-duree`);
        if (duo !== null) duo.textContent = formaterDuree(duree);
        majResume();
      });
    }
  }

  saisie.addEventListener('change', () => {
    void ajouterFichiers([...(saisie.files ?? [])]).then(() => {
      saisie.value = '';
    });
  });
  zone.addEventListener('dragover', (evenement) => {
    if (evenement.dataTransfer?.types.includes('Files') === true) {
      evenement.preventDefault();
      zone.classList.add('survol');
    }
  });
  zone.addEventListener('dragleave', () => zone.classList.remove('survol'));
  zone.addEventListener('drop', (evenement) => {
    evenement.preventDefault();
    zone.classList.remove('survol');
    void ajouterFichiers([...(evenement.dataTransfer?.files ?? [])]);
  });

  boutonPubliee.addEventListener('click', () => {
    const piste = options.depot.pistes.find((p) => p.mp3.chemin === choixPubliee.value);
    if (piste === undefined) return;
    boutonPubliee.disabled = true;
    options.espace
      .ficheBrute(piste)
      .then((fiche) => {
        compteur += 1;
        lignes.push({
          cle: `publiee-${compteur}`,
          titre: (typeof fiche?.['titre'] === 'string' ? fiche['titre'] : '') || piste.base,
          artiste: typeof fiche?.['artiste'] === 'string' ? fiche['artiste'] : '',
          disque: 1,
          source: { type: 'publiee', piste, fiche },
        });
        trier();
        rendre();
        changer();
      })
      .catch((erreur: unknown) => {
        retourAjout.textContent = messageErreur(erreur);
      })
      .finally(() => {
        boutonPubliee.disabled = false;
      });
  });

  rendre();
  return {
    element: racine,
    lignes: () => [...lignes],
    definir(nouvelles) {
      lignes = [...nouvelles];
      compteur += nouvelles.length;
      trier();
      rendre();
    },
    resume: resumeActuel,
  };
}
