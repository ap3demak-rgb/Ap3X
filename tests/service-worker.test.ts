// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  PREFIXE_CACHE,
  cachesASupprimer,
  choisirStrategie,
  listePrechargement,
  type RequeteDecrite,
} from '../src/sw/strategies';

const BASE = '/Ap3X/';
const ORIGINE = 'https://x.test';

function requete(chemin: string, extras: Partial<RequeteDecrite> = {}): RequeteDecrite {
  return { url: `${ORIGINE}${chemin}`, methode: 'GET', mode: 'cors', plage: false, ...extras };
}
const strategie = (chemin: string, extras: Partial<RequeteDecrite> = {}) =>
  choisirStrategie(requete(chemin, extras), BASE, ORIGINE);

describe('stratégies du service worker', () => {
  it("charge les pages réseau d'abord, avec la coquille hors ligne", () => {
    expect(strategie('/Ap3X/', { mode: 'navigate' })).toBe('navigation');
    expect(strategie('/Ap3X/partage/piste/a/', { mode: 'navigate' })).toBe('navigation');
    expect(strategie('/Ap3X/#/albums', { mode: 'navigate' })).toBe('navigation');
  });

  it('met le catalogue en revalidation', () => {
    expect(strategie('/Ap3X/catalogue.json')).toBe('revalidation');
  });

  it("met en cache d'abord les ressources à nom unique", () => {
    for (const chemin of [
      '/Ap3X/assets/index-abc.js',
      '/Ap3X/assets/style-abc.css',
      '/Ap3X/pochettes/0123-m.webp',
      '/Ap3X/icones/logo.svg',
      '/Ap3X/manifest.webmanifest',
      '/Ap3X/favicon.ico',
    ]) {
      expect(strategie(chemin), chemin).toBe('cache-d-abord');
    }
  });

  it("ne touche jamais à l'audio, aux fiches, ni aux requêtes par plages", () => {
    expect(strategie('/Ap3X/musique/techno/300.mp3')).toBe('ignorer');
    expect(strategie('/Ap3X/musique/techno/300.json')).toBe('ignorer');
    expect(strategie('/Ap3X/assets/x.js', { plage: true })).toBe('ignorer');
    expect(strategie('/Ap3X/musique/a.mp3', { mode: 'navigate' })).toBe('ignorer');
  });

  it("ignore ce qui n'est pas à lui : autre méthode, autre origine, autre chemin, service worker", () => {
    expect(strategie('/Ap3X/catalogue.json', { methode: 'POST' })).toBe('ignorer');
    expect(
      choisirStrategie(
        { url: 'https://autre.test/Ap3X/assets/x.js', methode: 'GET', mode: 'cors', plage: false },
        BASE,
        ORIGINE,
      ),
    ).toBe('ignorer');
    expect(strategie('/ailleurs/assets/x.js')).toBe('ignorer');
    expect(strategie('/Ap3X/sw.js')).toBe('ignorer');
    expect(strategie('/Ap3X/sitemap.xml')).toBe('ignorer');
    expect(
      choisirStrategie(
        { url: 'pas une url', methode: 'GET', mode: 'cors', plage: false },
        BASE,
        ORIGINE,
      ),
    ).toBe('ignorer');
  });
});

describe('nettoyage des caches', () => {
  const courant = `${PREFIXE_CACHE}300-aaa`;

  it('garde le cache courant et le précédent le plus récent, supprime le reste', () => {
    const existants = [
      `${PREFIXE_CACHE}100-aaa`,
      `${PREFIXE_CACHE}200-bbb`,
      courant,
      `${PREFIXE_CACHE}50-ccc`,
    ];
    expect(cachesASupprimer(existants, courant).sort()).toEqual([
      `${PREFIXE_CACHE}100-aaa`,
      `${PREFIXE_CACHE}50-ccc`,
    ]);
  });

  it("ne touche pas aux caches d'autres applications, ni à un seul ancien cache", () => {
    expect(cachesASupprimer(['autre-cache', courant], courant)).toEqual([]);
    expect(cachesASupprimer([courant, `${PREFIXE_CACHE}200-bbb`], courant)).toEqual([]);
    expect(cachesASupprimer([], courant)).toEqual([]);
  });

  it('range un nom de cache sans horodatage valide parmi les plus anciens', () => {
    const existants = [`${PREFIXE_CACHE}zzz`, `${PREFIXE_CACHE}200-bbb`, courant];
    expect(cachesASupprimer(existants, courant)).toEqual([`${PREFIXE_CACHE}zzz`]);
  });
});

describe('liste de préchargement', () => {
  it("retient la coquille de l'application avec la racine, triée, sans audio ni pochettes", () => {
    const liste = listePrechargement(
      [
        'index.html',
        'catalogue.json',
        'manifest.webmanifest',
        'favicon.ico',
        'assets/index-a.js',
        'assets/moteur-b.js',
        'icones/logo.svg',
        'musique/techno/300.mp3',
        'pochettes/x.webp',
        'partage/piste/a/index.html',
        '404.html',
        'sw.js',
        'sitemap.xml',
      ],
      BASE,
    );
    expect(liste).toEqual([
      '/Ap3X/',
      '/Ap3X/assets/index-a.js',
      '/Ap3X/assets/moteur-b.js',
      '/Ap3X/catalogue.json',
      '/Ap3X/favicon.ico',
      '/Ap3X/icones/logo.svg',
      '/Ap3X/index.html',
      '/Ap3X/manifest.webmanifest',
    ]);
  });
});
