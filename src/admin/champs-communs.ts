// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv } from '../i18n';
import { champ, element, formaterTaille } from './dom';
import type { DepotAnalyse } from './espace';
import { preparerPochette, type PochettePreparee } from './image';

export const NOUVELLE_CATEGORIE = '\u0000nouvelle';

export interface ChampCategorie {
  elements: HTMLElement[];
  select: HTMLSelectElement;
  /** Dossier choisi, ou nom saisi pour une nouvelle catégorie. */
  lire(): string;
  ecrire(valeur: string): void;
}

/** Sélecteur de catégorie : les dossiers existants, ou « Nouvelle catégorie… » avec son nom à saisir. */
export function creerChampCategorie(depot: DepotAnalyse): ChampCategorie {
  const select = element('select');
  select.append(new Option('', ''));
  for (const dossier of depot.categories) select.append(new Option(dossier, dossier));
  select.append(new Option(t('admin.nouvelle.categorie_nouvelle'), NOUVELLE_CATEGORIE));
  const nom = element('input');
  nom.type = 'text';
  const champNom = champ(t('admin.nouvelle.categorie_nom'), nom);
  champNom.hidden = true;
  select.addEventListener('change', () => {
    const nouvelle = select.value === NOUVELLE_CATEGORIE;
    champNom.hidden = !nouvelle;
    if (nouvelle) nom.focus();
  });
  return {
    elements: [champ(t('admin.nouvelle.categorie'), select), champNom],
    select,
    lire: () => (select.value === NOUVELLE_CATEGORIE ? nom.value : select.value),
    ecrire(valeur) {
      if (depot.categories.includes(valeur) || valeur === '') {
        select.value = valeur;
      } else {
        select.value = NOUVELLE_CATEGORIE;
        nom.value = valeur;
      }
      champNom.hidden = select.value !== NOUVELLE_CATEGORIE;
    },
  };
}

export interface ChampPochette {
  elements: HTMLElement[];
  input: HTMLInputElement;
  /** Nouvelle pochette prête (redimensionnée). */
  pochette(): PochettePreparee | undefined;
  /** Adresse locale de l'aperçu de la nouvelle pochette. */
  adresse(): string | undefined;
  /** Utilise une image fournie par le programme (pochette intégrée à un MP3) ; `false` si elle est illisible. */
  definir(image: Blob, note?: string): Promise<boolean>;
}

/** Choix d'une image de pochette : redimensionnement, conversion WebP et aperçu. */
export function creerChampPochette(): ChampPochette {
  const langue = document.documentElement.lang;
  const input = element('input');
  input.type = 'file';
  input.accept = 'image/*';
  const apercu = element('img', 'admin-apercu');
  apercu.alt = '';
  apercu.hidden = true;
  const info = element('p', 'carte-meta');
  info.setAttribute('role', 'status');
  let preparee: PochettePreparee | undefined;
  let adresse: string | undefined;

  const effacer = (): void => {
    preparee = undefined;
    apercu.hidden = true;
    info.textContent = '';
    if (adresse !== undefined) URL.revokeObjectURL(adresse);
    adresse = undefined;
  };

  async function definir(image: Blob, note?: string): Promise<boolean> {
    effacer();
    try {
      const prete = await preparerPochette(image);
      preparee = prete;
      adresse = URL.createObjectURL(prete.blob);
      apercu.src = adresse;
      apercu.hidden = false;
      info.textContent = [
        tv('admin.nouvelle.pochette_prete', {
          largeur: prete.largeur,
          hauteur: prete.hauteur,
          taille: formaterTaille(prete.blob.size, langue),
        }),
        note ?? '',
      ]
        .filter((p) => p !== '')
        .join(' ');
      return true;
    } catch {
      info.textContent = t('admin.nouvelle.err_image');
      return false;
    }
  }

  input.addEventListener('change', () => {
    const fichier = input.files?.[0];
    if (fichier === undefined) {
      effacer();
      return;
    }
    void definir(fichier).then((ok) => {
      if (!ok) input.value = '';
    });
  });

  return {
    elements: [champ(t('admin.nouvelle.pochette'), input), apercu, info],
    input,
    pochette: () => preparee,
    adresse: () => adresse,
    definir,
  };
}
