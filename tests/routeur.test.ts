// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  analyserRoute,
  lienAlbum,
  lienArtiste,
  lienCategorie,
  lienPiste,
  lienPlaylist,
  lienRecherche,
  lienTag,
} from '../src/routeur';

describe('routeur par hash', () => {
  it('reconnaît les pages simples', () => {
    expect(analyserRoute('')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/licences')).toEqual({ nom: 'licences' });
    expect(analyserRoute('#/albums')).toEqual({ nom: 'albums' });
    expect(analyserRoute('#/categories')).toEqual({ nom: 'categories' });
    expect(analyserRoute('#/playlists')).toEqual({ nom: 'playlists' });
    expect(analyserRoute('#/playlist/abc')).toEqual({ nom: 'playlist', id: 'abc' });
    expect(analyserRoute('#/artiste/DJ%20X')).toEqual({ nom: 'artiste', id: 'DJ X' });
    expect(analyserRoute('#/recherche/caf%C3%A9%20cr%C3%A8me')).toEqual({
      nom: 'recherche',
      id: 'café crème',
    });
    expect(analyserRoute('#/categorie/techno')).toEqual({ nom: 'categorie', id: 'techno' });
    expect(analyserRoute('#/tag/live-set')).toEqual({ nom: 'tag', id: 'live-set' });
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
    expect(analyserRoute('#/categories/x')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/tag')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/playlists/x')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/recherche')).toEqual({ nom: 'accueil' });
    expect(analyserRoute('#/piste/%E0%A4%A')).toEqual({ nom: 'piste', id: '%E0%A4%A' });
  });

  it("produit des liens qui font l'aller-retour", () => {
    expect(analyserRoute(lienAlbum('a--b c'))).toEqual({ nom: 'album', id: 'a--b c' });
    expect(analyserRoute(lienPiste('x/y'))).toEqual({ nom: 'piste', id: 'x/y' });
    expect(analyserRoute(lienCategorie('tout'))).toEqual({ nom: 'categorie', id: 'tout' });
    expect(analyserRoute(lienTag('été & co'))).toEqual({ nom: 'tag', id: 'été & co' });
    expect(analyserRoute(lienArtiste('a/b'))).toEqual({ nom: 'artiste', id: 'a/b' });
    expect(analyserRoute(lienPlaylist('x-1'))).toEqual({ nom: 'playlist', id: 'x-1' });
    expect(analyserRoute(lienRecherche('a #b/c?'))).toEqual({ nom: 'recherche', id: 'a #b/c?' });
  });
});
