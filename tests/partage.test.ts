// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { construireLienPartage } from '../src/partage';

const base = { origine: 'https://x.test', base: '/Ap3X/' };

describe('lien de partage', () => {
  it('pointe vers la page de partage générée au build en production', () => {
    expect(
      construireLienPartage({ ...base, type: 'piste', id: 'rock--alpha', pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/piste/rock--alpha/');
    expect(
      construireLienPartage({ ...base, type: 'album', id: 'rock--ep', pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/album/rock--ep/');
  });

  it("pointe vers la route de l'application en développement", () => {
    expect(construireLienPartage({ ...base, type: 'piste', id: 'a', pagePartage: false })).toBe(
      'https://x.test/Ap3X/#/piste/a',
    );
  });

  it("ajoute l'instant de départ des pistes, et lui seul", () => {
    expect(
      construireLienPartage({ ...base, type: 'piste', id: 'a', instant: 90, pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/piste/a/?t=1m30s');
    expect(
      construireLienPartage({ ...base, type: 'piste', id: 'a', instant: 90, pagePartage: false }),
    ).toBe('https://x.test/Ap3X/#/piste/a?t=1m30s');
    expect(
      construireLienPartage({ ...base, type: 'piste', id: 'a', instant: 0, pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/piste/a/');
    expect(
      construireLienPartage({ ...base, type: 'album', id: 'a', instant: 90, pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/album/a/');
  });

  it('encode les identifiants', () => {
    expect(
      construireLienPartage({ ...base, type: 'piste', id: 'été & co/1?', pagePartage: true }),
    ).toBe('https://x.test/Ap3X/partage/piste/%C3%A9t%C3%A9%20%26%20co%2F1%3F/');
  });
});
