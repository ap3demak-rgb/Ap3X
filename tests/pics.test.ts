// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import { picsDepuisCanaux } from '../scripts/catalogue/pics';

describe('pics de la waveform', () => {
  it('normalise sur le pic le plus élevé et garde le nombre de barres demandé', () => {
    const canal = new Float32Array(1000);
    canal[10] = 0.25;
    canal[510] = -0.5;
    const pics = picsDepuisCanaux([canal], 10);
    expect(pics).toHaveLength(10);
    expect(pics[0]).toBe(50);
    expect(pics[5]).toBe(100);
    expect(pics[9]).toBe(0);
  });

  it('prend le maximum de tous les canaux', () => {
    const gauche = new Float32Array(100);
    const droite = new Float32Array(100);
    droite[99] = 0.8;
    gauche[0] = 0.4;
    expect(picsDepuisCanaux([gauche, droite], 2)).toEqual([50, 100]);
  });

  it('renvoie des zéros pour un signal silencieux et rien pour un signal vide', () => {
    expect(picsDepuisCanaux([new Float32Array(50)], 5)).toEqual([0, 0, 0, 0, 0]);
    expect(picsDepuisCanaux([], 5)).toEqual([]);
    expect(picsDepuisCanaux([new Float32Array(0)], 5)).toEqual([]);
  });

  it("gère moins d'échantillons que de barres", () => {
    const pics = picsDepuisCanaux([Float32Array.from([1, 0.5])], 8);
    expect(pics).toHaveLength(8);
    expect(Math.max(...pics)).toBe(100);
  });
});
