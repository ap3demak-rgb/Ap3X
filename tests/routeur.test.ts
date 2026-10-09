// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  analyserInstant,
  analyserRoute,
  formaterInstant,
  instantDeLHash,
  parametresRoute,
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

describe('instants de partage', () => {
  it('lit les formats courants', () => {
    expect(analyserInstant('90')).toBe(90);
    expect(analyserInstant('90s')).toBe(90);
    expect(analyserInstant('1m30s')).toBe(90);
    expect(analyserInstant('1m')).toBe(60);
    expect(analyserInstant('2h')).toBe(7200);
    expect(analyserInstant('1h2m3s')).toBe(3723);
    expect(analyserInstant('1:30')).toBe(90);
    expect(analyserInstant('1:02:03')).toBe(3723);
    expect(analyserInstant('0:05')).toBe(5);
    expect(analyserInstant(' 1M30S ')).toBe(90);
    expect(analyserInstant('12.9')).toBe(12);
  });

  it("refuse ce qui n'est pas un instant", () => {
    for (const texte of ['', '   ', 'abc', '-5', '1m30x', 'm', 'h', '1:60:00:00', '1::30', 'NaN']) {
      expect(analyserInstant(texte), texte).toBeUndefined();
    }
    expect(analyserInstant(null)).toBeUndefined();
    expect(analyserInstant(undefined)).toBeUndefined();
  });

  it('formate et relit un instant sans perte', () => {
    expect(formaterInstant(0)).toBe('0s');
    expect(formaterInstant(45.9)).toBe('45s');
    expect(formaterInstant(90)).toBe('1m30s');
    expect(formaterInstant(60)).toBe('1m0s');
    expect(formaterInstant(3723)).toBe('1h2m3s');
    expect(formaterInstant(-4)).toBe('0s');
    for (const secondes of [0, 5, 59, 60, 61, 3599, 3600, 3723, 86399]) {
      expect(analyserInstant(formaterInstant(secondes))).toBe(secondes);
    }
  });

  it("extrait les paramètres d'un hash sans perturber la route", () => {
    expect(analyserRoute('#/piste/abc?t=1m30s')).toEqual({ nom: 'piste', id: 'abc' });
    expect(analyserRoute('#/album/x?foo=bar')).toEqual({ nom: 'album', id: 'x' });
    expect(analyserRoute('#/albums?x=1')).toEqual({ nom: 'albums' });
    expect(parametresRoute('#/piste/abc?t=90&autre=1').get('autre')).toBe('1');
    expect(instantDeLHash('#/piste/abc?t=1m30s')).toBe(90);
    expect(instantDeLHash('#/piste/abc')).toBeUndefined();
    expect(instantDeLHash('#/piste/abc?t=bof')).toBeUndefined();
    // Un identifiant contenant « ? » est encodé par les liens et ne se confond pas avec les paramètres.
    expect(analyserRoute(lienPiste('a?b'))).toEqual({ nom: 'piste', id: 'a?b' });
  });
});
