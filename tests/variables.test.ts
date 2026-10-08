// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { remplacerVariables } from '../src/i18n/variables';

describe('variables de traduction', () => {
  it('remplace les variables connues, nombres compris', () => {
    expect(remplacerVariables('{n} pistes', { n: 12 })).toBe('12 pistes');
    expect(remplacerVariables('Se déplacer dans {titre} ({n})', { titre: 'A', n: '1 000' })).toBe(
      'Se déplacer dans A (1 000)',
    );
  });

  it('laisse intacte une variable inconnue ou héritée du prototype', () => {
    expect(remplacerVariables('{x} et {toString}', {})).toBe('{x} et {toString}');
  });

  it('remplace plusieurs occurrences', () => {
    expect(remplacerVariables('{n}/{n}', { n: 3 })).toBe('3/3');
  });
});
