// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { analyserCouleur, ratioContraste } from '../scripts/contrastes';

describe('contrastes WCAG', () => {
  it('donne 21:1 pour noir sur blanc et 1:1 pour une couleur identique', () => {
    expect(ratioContraste('#000000', '#ffffff')).toBeCloseTo(21, 5);
    expect(ratioContraste('#336699', '#336699')).toBeCloseTo(1, 5);
  });

  it('est symétrique', () => {
    expect(ratioContraste('#ff8a2b', '#0b0b10')).toBeCloseTo(
      ratioContraste('#0b0b10', '#ff8a2b'),
      10,
    );
  });

  it('retrouve la valeur de référence #767676 sur blanc (4,54:1)', () => {
    expect(ratioContraste('#767676', '#ffffff')).toBeCloseTo(4.54, 2);
  });

  it('refuse une couleur mal formée', () => {
    expect(() => analyserCouleur('rouge')).toThrow();
    expect(() => analyserCouleur('#fff')).toThrow();
  });
});
