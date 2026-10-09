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

function fabrique(): () => string {
  let n = 0;
  return () => `id${(n += 1)}`;
}

async function creer(stockage = new StockageMemoire()) {
  const { Playlists } = await import('../src/playlists');
  return { stockage, playlists: new Playlists(stockage, fabrique()) };
}

describe('noms', () => {
  it('nettoie et valide les noms', async () => {
    const { nettoyerNom, nomDisponible, LONGUEUR_NOM_MAX } = await import('../src/playlists');
    expect(nettoyerNom('  Ma   liste  ')).toBe('Ma liste');
    expect(nettoyerNom('   ')).toBeUndefined();
    expect(nettoyerNom('x'.repeat(LONGUEUR_NOM_MAX + 1))).toBeUndefined();
    expect(nomDisponible('Mix', [])).toBe('Mix');
    expect(nomDisponible('Mix', ['mix'])).toBe('Mix (2)');
    expect(nomDisponible('Mix', ['Mix', 'Mix (2)'])).toBe('Mix (3)');
  });
});

describe('playlists', () => {
  it('crée, renomme et supprime', async () => {
    const { playlists } = await creer();
    const a = playlists.creer('Route');
    expect(a).toMatchObject({ id: 'id1', nom: 'Route', pistes: [] });
    expect(playlists.creer('  ')).toBeUndefined();
    expect(playlists.creer('route')?.nom).toBe('route (2)');
    expect(playlists.renommer('id1', 'Soirée')).toBe(true);
    expect(playlists.obtenir('id1')?.nom).toBe('Soirée');
    expect(playlists.renommer('id1', '')).toBe(false);
    expect(playlists.renommer('absente', 'X')).toBe(false);
    // Renommer avec son propre nom ne crée pas de suffixe.
    expect(playlists.renommer('id1', 'soirée')).toBe(true);
    expect(playlists.obtenir('id1')?.nom).toBe('soirée');
    expect(playlists.supprimer('id2')).toBe(true);
    expect(playlists.supprimer('id2')).toBe(false);
    expect(playlists.toutes().map((p) => p.id)).toEqual(['id1']);
  });

  it('ajoute des pistes sans doublon et renvoie le nombre ajouté', async () => {
    const { playlists } = await creer();
    const liste = playlists.creer('A', ['p1', 'p1', 'p2']);
    expect(liste?.pistes).toEqual(['p1', 'p2']);
    expect(playlists.ajouterPistes('id1', ['p2', 'p3', 'p3', 'p4'])).toBe(2);
    expect(playlists.obtenir('id1')?.pistes).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(playlists.ajouterPistes('id1', ['p1'])).toBe(0);
    expect(playlists.ajouterPistes('absente', ['p1'])).toBe(0);
  });

  it('retire et déplace des pistes', async () => {
    const { playlists } = await creer();
    playlists.creer('A', ['a', 'b', 'c', 'd']);
    expect(playlists.retirerPiste('id1', 1)).toBe(true);
    expect(playlists.obtenir('id1')?.pistes).toEqual(['a', 'c', 'd']);
    expect(playlists.retirerPiste('id1', 9)).toBe(false);
    expect(playlists.deplacerPiste('id1', 2, 0)).toBe(true);
    expect(playlists.obtenir('id1')?.pistes).toEqual(['d', 'a', 'c']);
    expect(playlists.deplacerPiste('id1', 0, 0)).toBe(false);
    expect(playlists.deplacerPiste('id1', 0, 3)).toBe(false);
  });

  it('notifie chaque modification et persiste', async () => {
    const { playlists, stockage } = await creer();
    const surChangement = vi.fn();
    playlists.addEventListener('change', surChangement);
    playlists.creer('A', ['p1']);
    playlists.ajouterPistes('id1', ['p2']);
    playlists.renommer('id1', 'B');
    expect(surChangement).toHaveBeenCalledTimes(3);

    const { Playlists } = await import('../src/playlists');
    const relu = new Playlists(stockage, fabrique());
    expect(relu.toutes()).toEqual([{ id: 'id1', nom: 'B', pistes: ['p1', 'p2'] }]);

    // Modification venue d'un autre onglet.
    stockage.setItem('ap3x.playlists', JSON.stringify([{ id: 'z', nom: 'Z', pistes: [] }]));
    playlists.recharger();
    expect(playlists.toutes().map((p) => p.id)).toEqual(['z']);
    expect(surChangement).toHaveBeenCalledTimes(4);
  });

  it('ignore un stockage corrompu ou invalide', async () => {
    const stockage = new StockageMemoire();
    const { Playlists } = await import('../src/playlists');
    stockage.setItem('ap3x.playlists', '{pas du json');
    expect(new Playlists(stockage).toutes()).toEqual([]);
    stockage.setItem('ap3x.playlists', JSON.stringify([{ id: 'a', nom: '', pistes: [] }]));
    expect(new Playlists(stockage).toutes()).toEqual([]);
    stockage.setItem('ap3x.playlists', JSON.stringify({ a: 1 }));
    expect(new Playlists(stockage).toutes()).toEqual([]);
  });

  it('fonctionne sans stockage', async () => {
    const { Playlists } = await import('../src/playlists');
    const playlists = new Playlists(undefined, fabrique());
    expect(playlists.creer('A')?.id).toBe('id1');
  });
});

describe('export et import', () => {
  it("fait l'aller-retour sans rien perdre", async () => {
    const { playlists } = await creer();
    playlists.creer('Route', ['a', 'b']);
    playlists.creer('Nuit', ['c']);
    const texte = playlists.exporter();
    expect(JSON.parse(texte)).toMatchObject({ format: 'ap3x-playlists', version: 1 });

    const { playlists: autre } = await creer();
    expect(autre.importer(texte)).toEqual({ ajoutees: 2 });
    expect(autre.toutes().map((p) => ({ nom: p.nom, pistes: p.pistes }))).toEqual([
      { nom: 'Route', pistes: ['a', 'b'] },
      { nom: 'Nuit', pistes: ['c'] },
    ]);
  });

  it("n'écrase jamais une playlist existante : nouveaux identifiants et noms suffixés", async () => {
    const { playlists } = await creer();
    playlists.creer('Route', ['a']);
    const texte = playlists.exporter();
    expect(playlists.importer(texte)).toEqual({ ajoutees: 1 });
    expect(playlists.toutes().map((p) => p.nom)).toEqual(['Route', 'Route (2)']);
    expect(new Set(playlists.toutes().map((p) => p.id)).size).toBe(2);
    expect(playlists.obtenir('id1')?.pistes).toEqual(['a']);
  });

  it('refuse un fichier invalide sans rien modifier', async () => {
    const { ImportInvalide } = await import('../src/playlists');
    const { playlists } = await creer();
    playlists.creer('Route');
    for (const texte of [
      'pas du json',
      '{}',
      JSON.stringify({ format: 'autre', version: 1, playlists: [] }),
      JSON.stringify({ format: 'ap3x-playlists', version: 2, playlists: [] }),
      JSON.stringify({
        format: 'ap3x-playlists',
        version: 1,
        playlists: [{ id: 'a', nom: '', pistes: [] }],
      }),
      JSON.stringify({
        format: 'ap3x-playlists',
        version: 1,
        playlists: [{ id: 'a', nom: 'X', pistes: [1] }],
      }),
    ]) {
      expect(() => playlists.importer(texte)).toThrow(ImportInvalide);
    }
    expect(playlists.toutes()).toHaveLength(1);
  });

  it('accepte un export vide', async () => {
    const { playlists } = await creer();
    const texte = JSON.stringify({ format: 'ap3x-playlists', version: 1, playlists: [] });
    expect(playlists.importer(texte)).toEqual({ ajoutees: 0 });
  });
});
