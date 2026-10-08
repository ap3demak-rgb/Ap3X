// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { CATEGORIES_RESERVEES, categoriesSupplementaires } from '../scripts/catalogue/categories';

const connues = new Set(['rock', 'techno', 'ambient']);

describe('catégories supplémentaires', () => {
  it('retient les catégories existantes de la fiche, par nom ou identifiant', () => {
    const resultat = categoriesSupplementaires({
      principale: 'rock',
      demandees: ['Techno', 'ambient'],
      genres: [],
      connues,
    });
    expect(resultat).toEqual({ slugs: ['techno', 'ambient'], inconnues: [] });
  });

  it('signale les catégories inconnues de la fiche mais ignore silencieusement les genres inconnus', () => {
    const resultat = categoriesSupplementaires({
      principale: 'rock',
      demandees: ['Jazz'],
      genres: ['Techno', 'Metal'],
      connues,
    });
    expect(resultat.inconnues).toEqual(['Jazz']);
    expect(resultat.slugs).toEqual(['techno']);
  });

  it('exclut la catégorie principale et les doublons', () => {
    const resultat = categoriesSupplementaires({
      principale: 'rock',
      demandees: ['rock', 'techno'],
      genres: ['TECHNO', 'Rock'],
      connues,
    });
    expect(resultat.slugs).toEqual(['techno']);
  });

  it('réserve les identifiants des pages spéciales', () => {
    expect(CATEGORIES_RESERVEES).toEqual(['tout', 'favoris']);
  });
});
