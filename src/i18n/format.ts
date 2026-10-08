// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { obtenirLangue, tv } from './index';

/** Sélectionne la forme plurielle adaptée à la langue courante (repli sur « other »). */
export function pluriel(
  quantite: number,
  formes: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  const categorie = new Intl.PluralRules(obtenirLangue()).select(quantite);
  return formes[categorie] ?? formes.other;
}

/**
 * Formate une date de sortie ISO partielle (« 2024 », « 2024-05 », « 2024-05-03 ») selon la langue
 * courante, en n'affichant que la précision connue. Le fuseau UTC évite tout décalage de jour.
 */
export function formaterDate(date: string): string {
  const parties = date.split('-');
  const options: Intl.DateTimeFormatOptions =
    parties.length === 1
      ? { year: 'numeric', timeZone: 'UTC' }
      : parties.length === 2
        ? { year: 'numeric', month: 'long', timeZone: 'UTC' }
        : { dateStyle: 'long', timeZone: 'UTC' };
  const valeur = new Date(
    Date.UTC(Number(parties[0]), Number(parties[1] ?? 1) - 1, Number(parties[2] ?? 1)),
  );
  return new Intl.DateTimeFormat(obtenirLangue(), options).format(valeur);
}

/** Formate une durée en secondes : « 3:05 » ou « 1:02:09 », chiffres selon la langue courante. */
export function formaterDuree(secondes: number): string {
  const total = Math.max(0, Math.round(secondes));
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const reste = total % 60;
  const langue = obtenirLangue();
  const simple = new Intl.NumberFormat(langue, { useGrouping: false });
  const deuxChiffres = new Intl.NumberFormat(langue, {
    minimumIntegerDigits: 2,
    useGrouping: false,
  });
  if (heures > 0) {
    return `${simple.format(heures)}:${deuxChiffres.format(minutes)}:${deuxChiffres.format(reste)}`;
  }
  return `${simple.format(minutes)}:${deuxChiffres.format(reste)}`;
}

/** Forme plurielle (clé de traduction) adaptée au nombre, pour la langue courante. */
function formePlurielle(nombre: number): 'one' | 'few' | 'many' | 'other' {
  const categorie = new Intl.PluralRules(obtenirLangue()).select(nombre);
  return categorie === 'one' || categorie === 'few' || categorie === 'many' ? categorie : 'other';
}

function nombreFormate(nombre: number): string {
  return new Intl.NumberFormat(obtenirLangue()).format(nombre);
}

/** « 12 pistes », avec l'accord au pluriel de la langue courante. */
export function comptePistes(nombre: number): string {
  return tv(`compte.pistes.${formePlurielle(nombre)}`, { n: nombreFormate(nombre) });
}

/** « 3 albums », avec l'accord au pluriel de la langue courante. */
export function compteAlbums(nombre: number): string {
  return tv(`compte.albums.${formePlurielle(nombre)}`, { n: nombreFormate(nombre) });
}
