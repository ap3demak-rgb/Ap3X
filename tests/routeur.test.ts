// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { analyserRoute, lienAlbum, lienPiste } from '../src/routeur';

describe('routeur par hash', () => {
  it('reconnaît les pages simples', () => {
    expect(analyserRoute('')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/licences')).toEqual({ nom: 'licences' });
    expect(analyserRoute('#/albums')).toEqual({ nom: 'albums' });
  });

  it('extrait et décode les identifiants', () => {
    expect(analyserRoute('#/album/rock--mon-album')).toEqual({
      nom: 'album',
      id: 'rock--mon-album',
    });
    expect(analyserRoute('#/piste/%E6%97%A5%E6%9C%AC--a')).toEqual({ nom: 'piste', id: '日本--a' });
  });

  it("renvoie à l'accueil pour une route inconnue ou mal formée", () => {
    expect(analyserRoute('#/inconnue')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/album')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/album/a/b')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/piste/%E0%A4%A')).toEqual({ nom: 'piste', id: '%E0%A4%A' });
  });

  it("produit des liens qui font l'aller-retour", () => {
    expect(analyserRoute(lienAlbum('a--b c'))).toEqual({ nom: 'album', id: 'a--b c' });
    expect(analyserRoute(lienPiste('x/y'))).toEqual({ nom: 'piste', id: 'x/y' });
  });
});
