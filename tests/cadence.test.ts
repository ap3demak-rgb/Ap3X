// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { estBatterieFaible, intervalleImages } from '../src/rendu3d/cadence';

describe('cadence du rendu 3D', () => {
  it('ne limite pas la cadence sur ordinateur avec une batterie suffisante (60 images/s)', () => {
    expect(intervalleImages({ tactile: false, batterieFaible: false })).toBe(0);
  });

  it('limite à 30 images/s sur mobile et sur batterie faible', () => {
    expect(intervalleImages({ tactile: true, batterieFaible: false })).toBeCloseTo(33.33, 1);
    expect(intervalleImages({ tactile: false, batterieFaible: true })).toBeCloseTo(33.33, 1);
    expect(intervalleImages({ tactile: true, batterieFaible: true })).toBeCloseTo(33.33, 1);
  });

  it('juge la batterie faible sous 20 % et hors charge seulement', () => {
    expect(estBatterieFaible(0.19, false)).toBe(true);
    expect(estBatterieFaible(0.2, false)).toBe(false);
    expect(estBatterieFaible(0.05, true)).toBe(false);
    expect(estBatterieFaible(1, false)).toBe(false);
    expect(estBatterieFaible(0, false)).toBe(true);
  });
});
