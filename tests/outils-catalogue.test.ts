// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  deduireTypeAlbum,
  extraireHashtags,
  fusionnerHashtags,
  normaliserDate,
  slugifier,
  urlRelative,
} from '../scripts/catalogue/outils';

describe('outils du catalogue', () => {
  it('crée des identifiants sans accents ni espaces', () => {
    expect(slugifier('Mon Titre Été (Live)')).toBe('mon-titre-ete-live');
    expect(slugifier('  --Rock & Roll--  ')).toBe('rock-roll');
    expect(slugifier('日本語 タイトル')).toBe('日本語-タイトル');
  });

  it("déduit le type d'album selon le nombre de pistes", () => {
    expect(deduireTypeAlbum(1)).toBe('single');
    expect(deduireTypeAlbum(2)).toBe('ep');
    expect(deduireTypeAlbum(6)).toBe('ep');
    expect(deduireTypeAlbum(7)).toBe('lp');
  });

  it('extrait et fusionne les hashtags', () => {
    expect(extraireHashtags('Un titre #Demo et #live-set, pas# ça')).toEqual(['demo', 'live-set']);
    expect(fusionnerHashtags(['Live', '#Rock Roll'], ['live', 'demo'])).toEqual([
      'live',
      'rock-roll',
      'demo',
    ]);
  });

  it('normalise les dates', () => {
    expect(normaliserDate('2024')).toBe('2024');
    expect(normaliserDate('2024-05-03T10:00:00Z')).toBe('2024-05-03');
    expect(normaliserDate('2024-05')).toBe('2024-05');
    expect(normaliserDate('hier')).toBeUndefined();
    expect(normaliserDate(undefined)).toBeUndefined();
  });

  it('encode les chemins segment par segment', () => {
    expect(urlRelative('musique', 'Rock & Roll', 'Été.mp3')).toBe(
      'musique/Rock%20%26%20Roll/%C3%89t%C3%A9.mp3',
    );
  });
});
