// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { baliseReglages, echapperHtml, lireSite } from '../scripts/site';
import { analyserArbre } from '../src/admin/depot';
import { fichiersJsonEditables, typeFichierJson, validerFichierJson } from '../src/admin/json';
import {
  DESCRIPTEURS,
  ecrireChemin,
  GROUPES,
  identifiantsConnus,
  lireChemin,
  reglagesDepuisFichier,
  serialiserReglages,
  validerReglages,
} from '../src/admin/site-champs';
import { lireReglages, reglagesParDefaut } from '../src/site/reglages';
import { ReglagesSchema } from '../src/site/schema';

describe('lecture tolérante des réglages', () => {
  it('donne les valeurs par défaut pour tout ce qui manque ou est invalide', () => {
    expect(lireReglages(undefined)).toEqual(reglagesParDefaut());
    expect(lireReglages('texte')).toEqual(reglagesParDefaut());
    expect(lireReglages({ nom: 12, options: 'x', fond: null, liens: 3 })).toEqual(
      reglagesParDefaut(),
    );
  });

  it('garde les valeurs valides, borne les nombres et ignore les liens ou entrées de menu invalides', () => {
    const r = lireReglages({
      nom: '  Mon Label ',
      slogan: ' Musique libre ',
      liens: [
        { nom: 'Bandcamp', url: 'https://exemple.org/x' },
        { nom: 'Piège', url: 'javascript:alert(1)' },
        { nom: '', url: 'https://exemple.org' },
        { nom: 'Courriel', url: 'mailto:a@b.fr' },
        'texte',
      ],
      options: { telechargements: false, aleatoire: true },
      accueil: { misesEnAvant: ['a', 3, '', 'b'] },
      fond: { actif: false, intensite: 7, vitesse: 0, visualiseur: false },
      menu: { masques: ['albums', 'inconnu', 'licences'] },
    });
    expect(r.nom).toBe('Mon Label');
    expect(r.slogan).toBe('Musique libre');
    expect(r.liens.map((l) => l.nom)).toEqual(['Bandcamp', 'Courriel']);
    expect(r.options).toEqual({ telechargements: false, aleatoire: true });
    expect(r.accueil.misesEnAvant).toEqual(['a', 'b']);
    expect(r.fond).toEqual({ actif: false, intensite: 1, vitesse: 0.25, visualiseur: false });
    expect(r.menu.masques).toEqual(['albums', 'licences']);
  });

  it('les réglages par défaut respectent le schéma strict', () => {
    expect(ReglagesSchema.safeParse(reglagesParDefaut()).success).toBe(true);
  });

  it('le fichier public/site.json du dépôt est valide et lu à l’identique par les deux lecteurs', () => {
    const brut: unknown = JSON.parse(readFileSync('public/site.json', 'utf8'));
    const strict = ReglagesSchema.parse(brut);
    expect(lireReglages(brut)).toEqual(strict);
  });
});

describe('validation stricte', () => {
  const valide = reglagesParDefaut();

  it('refuse les champs inconnus, les liens dangereux et les valeurs hors limites', () => {
    const cas: [string, unknown][] = [
      ['champ inconnu', { ...valide, truc: 1 }],
      ['nom vide', { ...valide, nom: '  ' }],
      ['lien javascript', { ...valide, liens: [{ nom: 'x', url: 'javascript:alert(1)' }] }],
      ['intensité', { ...valide, fond: { ...valide.fond, intensite: 2 } }],
      ['vitesse', { ...valide, fond: { ...valide.fond, vitesse: 10 } }],
      ['menu', { ...valide, menu: { masques: ['admin'] } }],
      ['version', { ...valide, version: 2 }],
      ['trop de mises en avant', { ...valide, accueil: { misesEnAvant: Array(13).fill('a') } }],
    ];
    for (const [nom, brut] of cas) {
      expect(validerReglages(brut).ok, nom).toBe(false);
    }
    expect(validerReglages(valide).ok).toBe(true);
  });

  it('indique le chemin du champ en cause', () => {
    const resultat = validerReglages({ ...valide, liens: [{ nom: 'x', url: 'ftp://x' }] });
    expect(resultat.ok).toBe(false);
    if (!resultat.ok) expect(resultat.problemes[0]?.chemin).toBe('liens.0.url');
  });

  it('sérialise avec deux espaces et un retour final, et complète un fichier partiel', () => {
    const texte = serialiserReglages(valide);
    expect(texte.endsWith('\n')).toBe(true);
    expect(texte.split('\n')[1]).toBe('  "version": 1,');
    expect(reglagesDepuisFichier({ nom: 'Autre', fond: { vitesse: 2 } })).toMatchObject({
      nom: 'Autre',
      fond: { actif: true, intensite: 1, vitesse: 2, visualiseur: true },
    });
  });
});

describe('chemins et descripteurs du formulaire', () => {
  it('lit et écrit une valeur imbriquée sans modifier l’original', () => {
    const r = reglagesParDefaut();
    expect(lireChemin(r, 'fond.vitesse')).toBe(1);
    expect(lireChemin(r, 'fond.inconnu.x')).toBeUndefined();
    const copie = ecrireChemin(r, 'fond.vitesse', 2);
    expect(lireChemin(copie, 'fond.vitesse')).toBe(2);
    expect(lireChemin(copie, 'fond.actif')).toBe(true);
    expect(r.fond.vitesse).toBe(1);
  });

  it('chaque champ du schéma a un descripteur (et aucun n’est inventé)', () => {
    const feuilles = [
      'nom',
      'slogan',
      'description',
      'liens',
      'options.telechargements',
      'options.aleatoire',
      'accueil.misesEnAvant',
      'fond.actif',
      'fond.intensite',
      'fond.vitesse',
      'fond.visualiseur',
      'menu.masques',
    ];
    expect(DESCRIPTEURS.map((d) => d.chemin).sort()).toEqual([...feuilles].sort());
    for (const d of DESCRIPTEURS) {
      expect(lireChemin(reglagesParDefaut(), d.chemin), d.chemin).toBeDefined();
    }
    expect(GROUPES.length).toBeGreaterThan(0);
  });

  it('un formulaire entièrement rempli à partir des valeurs par défaut est valide', () => {
    let r = reglagesParDefaut();
    for (const d of DESCRIPTEURS) r = ecrireChemin(r, d.chemin, lireChemin(r, d.chemin));
    expect(validerReglages(r).ok).toBe(true);
  });

  it('connaît les identifiants de pistes et d’albums du dépôt', () => {
    const depot = analyserArbre(
      [
        'public/musique/ambient/brume.mp3',
        'public/musique/ambient/Nuit/album.json',
        'public/musique/ambient/Nuit/lune.mp3',
      ].map((chemin) => ({ chemin, type: 'blob' as const, sha: 's', taille: 1 })),
    );
    expect([...identifiantsConnus(depot)].sort()).toEqual([
      'ambient--brume',
      'ambient--nuit',
      'ambient--nuit--lune',
    ]);
  });
});

describe('éditeur JSON', () => {
  it('reconnaît le type des fichiers modifiables', () => {
    expect(typeFichierJson('public/site.json')).toBe('site');
    expect(typeFichierJson('public/manifest.webmanifest')).toBe('manifeste');
    expect(typeFichierJson('public/musique/ambient/categorie.json')).toBe('categorie');
    expect(typeFichierJson('public/musique/ambient/Nuit/album.json')).toBe('album');
    expect(typeFichierJson('public/musique/ambient/brume.json')).toBe('piste');
    expect(typeFichierJson('public/musique/ambient/Nuit/lune.json')).toBe('piste');
    expect(typeFichierJson('package.json')).toBeUndefined();
    expect(typeFichierJson('public/catalogue.json')).toBeUndefined();
    expect(typeFichierJson('public/musique/ambient/cover.webp')).toBeUndefined();
  });

  it('liste les fichiers du dépôt par chemin', () => {
    const depot = analyserArbre(
      [
        'package.json',
        'public/site.json',
        'public/manifest.webmanifest',
        'public/musique/b/categorie.json',
        'public/musique/a/x.mp3',
        'public/musique/a/x.json',
      ].map((chemin) => ({ chemin, type: 'blob' as const, sha: `s-${chemin}`, taille: 1 })),
    );
    expect(fichiersJsonEditables(depot).map((f) => f.chemin)).toEqual([
      'public/manifest.webmanifest',
      'public/musique/a/x.json',
      'public/musique/b/categorie.json',
      'public/site.json',
    ]);
  });

  it('valide le JSON puis le schéma du type', () => {
    expect(validerFichierJson('site', '{')).toMatchObject({ ok: false });
    expect(validerFichierJson('site', '[]')).toMatchObject({ ok: false });
    expect(validerFichierJson('site', JSON.stringify(reglagesParDefaut()))).toEqual({ ok: true });
    expect(validerFichierJson('site', '{"version":1}')).toMatchObject({ ok: false });
    expect(validerFichierJson('categorie', '{"nom":"A","ordre":2}')).toEqual({ ok: true });
    expect(validerFichierJson('categorie', '{"ordre":0}')).toMatchObject({ ok: false });
    expect(validerFichierJson('piste', '{"titre":"A","hashtags":["x"]}')).toEqual({ ok: true });
    expect(validerFichierJson('piste', '{"inconnu":1}')).toMatchObject({ ok: false });
    expect(validerFichierJson('album', '{"titre":"A","pistes":[]}')).toMatchObject({ ok: false });
    expect(validerFichierJson('manifeste', '{"name":"x"}')).toEqual({ ok: true });
  });
});

describe('build : lecture du fichier de réglages', () => {
  let dossier = '';
  afterEach(() => {
    if (dossier !== '') rmSync(dossier, { recursive: true, force: true });
    dossier = '';
  });
  const ecrire = (contenu: string): string => {
    dossier = mkdtempSync(join(tmpdir(), 'ap3x-site-'));
    mkdirSync(join(dossier, 'public'));
    writeFileSync(join(dossier, 'public', 'site.json'), contenu);
    return dossier;
  };

  it('lit un fichier valide', () => {
    expect(lireSite(ecrire(JSON.stringify(reglagesParDefaut()))).nom).toBe('AP3X Records');
  });

  it('arrête le build avec la liste des problèmes quand le fichier est invalide', () => {
    expect(() => lireSite(ecrire('{"version":1,"nom":""}'))).toThrow(/réglages invalides/);
    expect(() => lireSite(ecrire('pas du json'))).toThrow(/JSON invalide/);
  });

  it('insère les réglages sans jamais pouvoir fermer la balise', () => {
    const r = { ...reglagesParDefaut(), slogan: '</script><script>alert(1)</script>' };
    const balise = baliseReglages(r);
    expect(balise.startsWith('<script type="application/json" id="reglages-site">')).toBe(true);
    expect(balise.slice(0, -'</script>'.length)).not.toContain('</script');
    const json = balise.replace(/^<script[^>]*>/, '').replace(/<\/script>$/, '');
    expect((JSON.parse(json) as { slogan: string }).slogan).toBe(r.slogan);
  });

  it('échappe le nom et la description pour les attributs HTML', () => {
    expect(echapperHtml('A & "B" <c>')).toBe('A &amp; &quot;B&quot; &lt;c&gt;');
  });
});
