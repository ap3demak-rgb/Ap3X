// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { TAILLE_PAGE, prochainsAffiches } from '../src/pagination';

describe('pagination des listes', () => {
  it('ajoute une page à la fois, sans jamais dépasser le total', () => {
    expect(prochainsAffiches(48, 150)).toBe(96);
    expect(prochainsAffiches(96, 150)).toBe(144);
    expect(prochainsAffiches(144, 150)).toBe(150);
    expect(prochainsAffiches(150, 150)).toBe(150);
    expect(prochainsAffiches(0, 10)).toBe(10);
    expect(prochainsAffiches(0, 0)).toBe(0);
  });

  it('accepte une taille de page personnalisée', () => {
    expect(prochainsAffiches(2, 10, 3)).toBe(5);
    expect(prochainsAffiches(9, 10, 3)).toBe(10);
  });

  it("affiche 48 éléments d'emblée", () => {
    expect(TAILLE_PAGE).toBe(48);
  });
});
