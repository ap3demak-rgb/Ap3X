// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { obtenirLangue } from './index';

/** Sélectionne la forme plurielle adaptée à la langue courante (repli sur « other »). */
export function pluriel(
  quantite: number,
  formes: Partial<Record<Intl.LDMLPluralRule, string>> & { other: string },
): string {
  const categorie = new Intl.PluralRules(obtenirLangue()).select(quantite);
  return formes[categorie] ?? formes.other;
}

/** Formate une date de sortie selon la langue courante. */
export function formaterDate(date: Date | string | number): string {
  return new Intl.DateTimeFormat(obtenirLangue(), { dateStyle: 'long' }).format(new Date(date));
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
