// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { beforeAll, describe, expect, it, vi } from 'vitest';

// Le module crée l'instance de l'application au chargement : il lui faut un `window`.
beforeAll(() => {
  vi.stubGlobal('window', new EventTarget());
});

class StockageMemoire {
  donnees = new Map<string, string>();
  getItem(cle: string): string | null {
    return this.donnees.get(cle) ?? null;
  }
  setItem(cle: string, valeur: string): void {
    this.donnees.set(cle, valeur);
  }
}

describe('favoris', () => {
  it("ajoute, retire et conserve l'ordre", async () => {
    const { Favoris } = await import('../src/favoris');
    const favoris = new Favoris(new StockageMemoire());
    expect(favoris.basculer('a')).toBe(true);
    expect(favoris.basculer('b')).toBe(true);
    expect(favoris.liste()).toEqual(['a', 'b']);
    expect(favoris.basculer('a')).toBe(false);
    expect(favoris.estFavori('a')).toBe(false);
    expect(favoris.liste()).toEqual(['b']);
  });

  it('notifie chaque changement', async () => {
    const { Favoris } = await import('../src/favoris');
    const favoris = new Favoris(new StockageMemoire());
    const surChangement = vi.fn();
    favoris.addEventListener('change', surChangement);
    favoris.basculer('a');
    favoris.basculer('a');
    expect(surChangement).toHaveBeenCalledTimes(2);
  });

  it('persiste dans le stockage et se recharge', async () => {
    const { Favoris } = await import('../src/favoris');
    const stockage = new StockageMemoire();
    const premier = new Favoris(stockage);
    premier.basculer('a');
    premier.basculer('b');
    expect(new Favoris(stockage).liste()).toEqual(['a', 'b']);

    // Modification venue d'un autre onglet.
    stockage.setItem('ap3x.favoris', JSON.stringify(['z']));
    const surChangement = vi.fn();
    premier.addEventListener('change', surChangement);
    premier.recharger();
    expect(premier.liste()).toEqual(['z']);
    expect(surChangement).toHaveBeenCalledTimes(1);
  });

  it('ignore un stockage corrompu ou de mauvais type', async () => {
    const { Favoris } = await import('../src/favoris');
    const stockage = new StockageMemoire();
    stockage.setItem('ap3x.favoris', '{pas du json');
    expect(new Favoris(stockage).liste()).toEqual([]);
    stockage.setItem('ap3x.favoris', JSON.stringify({ a: 1 }));
    expect(new Favoris(stockage).liste()).toEqual([]);
    stockage.setItem('ap3x.favoris', JSON.stringify(['a', 3, null, 'a', 'b']));
    expect(new Favoris(stockage).liste()).toEqual(['a', 'b']);
  });

  it('fonctionne sans stockage', async () => {
    const { Favoris } = await import('../src/favoris');
    const favoris = new Favoris(undefined);
    favoris.basculer('a');
    expect(favoris.estFavori('a')).toBe(true);
  });
});
