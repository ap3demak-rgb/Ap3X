// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  cheminPartage,
  echapperHtml,
  page404,
  pageDePartage,
  planDuSite,
  pourScript,
  robots,
  urlAbsolue,
  type PagePartage,
} from '../scripts/partage/pages';

const couleurs = { fond: '#0b0b10', texte: '#f2f2f7', accent: '#ff8a2b' };
const traductions = {
  en: { 'partage.ouvrir': 'Open' },
  fr: { 'partage.ouvrir': 'Ouvrir' },
};

function page(extras: Partial<PagePartage> = {}): PagePartage {
  return {
    titre: 'Alpha – Zoé',
    description: 'Zoé · 3:20 · Rock',
    image: 'https://exemple.test/Ap3X/musique/a.png',
    urlPage: 'https://exemple.test/Ap3X/partage/piste/rock--alpha/',
    type: 'music.song',
    grandeImage: true,
    route: '#/piste/rock--alpha',
    racine: '../../../',
    nomSite: 'AP3X Records',
    ...extras,
  };
}

describe('échappement', () => {
  it('neutralise les caractères du HTML et des attributs', () => {
    expect(echapperHtml('<a href="x" onclick=\'y\'>&</a>')).toBe(
      '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;&lt;/a&gt;',
    );
  });

  it('sérialise pour un script sans pouvoir fermer la balise', () => {
    const sortie = pourScript('</script><script>alert(1)</script>& ');
    expect(sortie).not.toContain('</script>');
    expect(sortie).not.toContain('<');
    expect(JSON.parse(sortie)).toBe('</script><script>alert(1)</script>& ');
  });
});

describe('adresses', () => {
  it('compose des adresses absolues avec une seule barre', () => {
    expect(urlAbsolue('https://x.test/Ap3X/', 'icones/a.png')).toBe(
      'https://x.test/Ap3X/icones/a.png',
    );
    expect(urlAbsolue('https://x.test/Ap3X', '/icones/a.png')).toBe(
      'https://x.test/Ap3X/icones/a.png',
    );
  });

  it("encode l'identifiant dans le chemin de partage", () => {
    expect(cheminPartage('piste', 'rock--alpha')).toBe('partage/piste/rock--alpha/');
    expect(cheminPartage('album', 'été & co/1')).toBe(
      'partage/album/%C3%A9t%C3%A9%20%26%20co%2F1/',
    );
  });
});

describe('page de partage', () => {
  it('contient les balises Open Graph et Twitter, la redirection et le lien de secours', () => {
    const html = pageDePartage(page(), couleurs, traductions);
    expect(html).toContain('<meta property="og:type" content="music.song" />');
    expect(html).toContain('<meta property="og:title" content="Alpha – Zoé" />');
    expect(html).toContain(
      '<meta property="og:image" content="https://exemple.test/Ap3X/musique/a.png" />',
    );
    expect(html).toContain(
      '<meta property="og:url" content="https://exemple.test/Ap3X/partage/piste/rock--alpha/" />',
    );
    expect(html).toContain(
      '<link rel="canonical" href="https://exemple.test/Ap3X/partage/piste/rock--alpha/" />',
    );
    expect(html).toContain('<meta name="twitter:card" content="summary_large_image" />');
    expect(html).toContain(
      '<meta http-equiv="refresh" content="0;url=../../../#/piste/rock--alpha" />',
    );
    expect(html).toContain('href="../../../#/piste/rock--alpha"');
    // L'instant demandé (?t=…) est transmis à l'application.
    expect(html).toContain(
      'location.replace("../../../" + "#/piste/rock--alpha" + location.search)',
    );
    expect(html).toContain('<title>Alpha – Zoé</title>');
  });

  it("utilise une petite carte quand l'image est l'icône du site, et le type album", () => {
    const html = pageDePartage(
      page({ grandeImage: false, type: 'music.album', route: '#/album/x' }),
      couleurs,
      traductions,
    );
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    expect(html).toContain('<meta property="og:type" content="music.album" />');
  });

  it('échappe les titres hostiles partout', () => {
    const html = pageDePartage(
      page({
        titre: '"><script>alert(1)</script>',
        description: "x' onmouseover='y",
        route: '#/piste/a"b',
      }),
      couleurs,
      traductions,
    );
    expect(html).not.toContain('<script>alert(1)</script>');
    expect(html).not.toContain('"><script');
    // Toutes les valeurs d'attribut `content` sont sûres.
    for (const [, valeur] of html.matchAll(/content="([^"]*)"/g)) {
      expect(valeur).not.toMatch(/[<>]/);
    }
    // Le script de redirection reste un script valide : la route est sérialisée en JSON.
    expect(html).toContain('"#/piste/a\\"b"');
  });

  it('embarque les traductions et le sélecteur de langue du navigateur', () => {
    const html = pageDePartage(page(), couleurs, traductions);
    expect(html).toContain('"fr":{"partage.ouvrir":"Ouvrir"}');
    expect(html).toContain('navigator.languages');
    expect(html).toContain('data-i18n="partage.ouvrir"');
  });
});

describe('404, plan du site et robots', () => {
  it('redirige immédiatement vers la base du site et reste utilisable sans script', () => {
    const html = page404('/Ap3X/', couleurs, traductions);
    expect(html).toContain('<meta http-equiv="refresh" content="0;url=/Ap3X/" />');
    expect(html).toContain('location.replace("/Ap3X/")');
    expect(html).toContain('<a href="/Ap3X/"');
    expect(html).toContain('<meta name="robots" content="noindex" />');
  });

  it('liste chaque adresse une fois, échappée', () => {
    const xml = planDuSite(['https://x.test/', 'https://x.test/a?b=1&c=2', 'https://x.test/']);
    expect(xml.match(/<url>/g)).toHaveLength(2);
    expect(xml).toContain('<loc>https://x.test/a?b=1&amp;c=2</loc>');
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
  });

  it("autorise l'indexation et référence le plan du site", () => {
    expect(robots('https://x.test/Ap3X')).toBe(
      'User-agent: *\nAllow: /\n\nSitemap: https://x.test/Ap3X/sitemap.xml\n',
    );
  });
});
