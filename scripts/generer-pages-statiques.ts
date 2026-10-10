// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cheminImagePartage } from '../src/catalogue/pochettes.ts';
import { CatalogueSchema, type Album, type Piste } from '../src/catalogue/schemas.ts';
import { BASE_SITE, URL_SITE } from '../src/constantes.ts';
import { lireSite } from './site.ts';
import { remplacerVariables } from '../src/i18n/variables.ts';
import { lienAlbum, lienPiste } from '../src/routeur.ts';
import {
  cheminPartage,
  page404,
  pageDePartage,
  planDuSite,
  robots,
  urlAbsolue,
  type Couleurs,
  type Traductions,
} from './partage/pages.ts';

/**
 * Après `vite build` : génère dans `dist/` les pages de partage (Open Graph) de chaque piste et de
 * chaque album, `404.html`, `sitemap.xml` et `robots.txt`.
 * Usage : tsx scripts/generer-pages-statiques.ts [dossier-dist]
 * L'adresse publique du site se règle avec la variable d'environnement SITE_URL.
 */
const dist = process.argv[2] ?? 'dist';
const site = lireSite();
const urlSite = (process.env['SITE_URL'] ?? URL_SITE).replace(/\/*$/, '/');
const CLES_TRADUITES = [
  'partage.ouvrir',
  'erreur.404.titre',
  'erreur.404.message',
  'erreur.404.lien',
];
const LANGUES = ['en', 'fr', 'de', 'ja', 'es', 'ru', 'vi', 'zh', 'ko'];

async function lireJson(chemin: string): Promise<unknown> {
  return JSON.parse(await readFile(chemin, 'utf8')) as unknown;
}

/** Couleurs de la page : lues dans le thème, source unique des couleurs. */
async function couleursDuTheme(): Promise<Couleurs> {
  const css = await readFile(join('src', 'styles', 'theme.css'), 'utf8');
  const lire = (jeton: string): string => {
    const valeur = new RegExp(`--${jeton}:\\s*(#[0-9a-fA-F]{6})`).exec(css)?.[1];
    if (valeur === undefined) throw new Error(`Jeton --${jeton} introuvable dans theme.css`);
    return valeur;
  };
  return { fond: lire('fond'), texte: lire('texte'), accent: lire('accent') };
}

async function traductions(): Promise<Traductions> {
  const resultat: Record<string, Record<string, string>> = {};
  for (const langue of LANGUES) {
    const dictionnaire = (await lireJson(join('src', 'i18n', `${langue}.json`))) as Record<
      string,
      string
    >;
    resultat[langue] = Object.fromEntries(
      CLES_TRADUITES.map((cle) => [cle, dictionnaire[cle] ?? '']),
    );
  }
  return resultat;
}

const catalogue = CatalogueSchema.parse(await lireJson(join(dist, 'catalogue.json')));
const anglais = (await lireJson(join('src', 'i18n', 'en.json'))) as Record<string, string>;
const mot = (cle: string, variables: Record<string, string | number> = {}): string =>
  remplacerVariables(anglais[cle] ?? cle, variables);
const pluriel = (n: number): string =>
  mot(n === 1 ? 'compte.pistes.one' : 'compte.pistes.other', { n });
const duree = (secondes: number): string => {
  const total = Math.round(secondes);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
};

const ICONE = { chemin: 'icones/icone-512.png' };
const categories = new Map(catalogue.categories.map((c) => [c.slug, c.nom]));
const couleurs = await couleursDuTheme();
const textes = await traductions();
const urls: string[] = [urlSite];

async function ecrire(chemin: string, contenu: string): Promise<void> {
  await mkdir(join(dist, ...chemin.split('/').slice(0, -1)), { recursive: true });
  await writeFile(join(dist, ...chemin.split('/')), contenu);
}

function pagePiste(piste: Piste): string {
  const description = [
    piste.artiste,
    duree(piste.duree),
    categories.get(piste.categorie) ?? piste.categorie,
  ].join(' · ');
  const image = piste.pochette !== undefined ? cheminImagePartage(piste.pochette) : ICONE.chemin;
  const chemin = cheminPartage('piste', piste.id);
  return pageDePartage(
    {
      titre: `${piste.titre} – ${piste.artiste}`,
      description,
      image: urlAbsolue(urlSite, image),
      urlPage: urlAbsolue(urlSite, chemin),
      type: 'music.song',
      // Les pochettes sont carrées : la petite carte (vignette carrée) les montre en entier.
      grandeImage: false,
      route: lienPiste(piste.id),
      racine: '../../../',
      nomSite: site.nom,
    },
    couleurs,
    textes,
  );
}

function pageAlbum(album: Album, premierePochette: string | undefined): string {
  const pochette = album.pochette ?? premierePochette;
  const description = [
    album.artiste,
    mot(`type.${album.type}`),
    pluriel(album.nombrePistes),
    duree(album.duree),
  ].join(' · ');
  return pageDePartage(
    {
      titre: `${album.titre} – ${album.artiste}`,
      description,
      image: urlAbsolue(
        urlSite,
        pochette !== undefined ? cheminImagePartage(pochette) : ICONE.chemin,
      ),
      urlPage: urlAbsolue(urlSite, cheminPartage('album', album.id)),
      type: 'music.album',
      grandeImage: false,
      route: lienAlbum(album.id),
      racine: '../../../',
      nomSite: site.nom,
    },
    couleurs,
    textes,
  );
}

for (const piste of catalogue.pistes) {
  const chemin = cheminPartage('piste', piste.id);
  await ecrire(`${chemin}index.html`, pagePiste(piste));
  urls.push(urlAbsolue(urlSite, chemin));
}
const pistesParId = new Map(catalogue.pistes.map((p) => [p.id, p]));
for (const album of catalogue.albums) {
  const chemin = cheminPartage('album', album.id);
  const premiere = album.pistes
    .map((id) => pistesParId.get(id)?.pochette)
    .find((p): p is string => p !== undefined);
  await ecrire(`${chemin}index.html`, pageAlbum(album, premiere));
  urls.push(urlAbsolue(urlSite, chemin));
}

await ecrire('404.html', page404(BASE_SITE, couleurs, textes));
await ecrire('sitemap.xml', planDuSite(urls));
await ecrire('robots.txt', robots(urlSite));

console.log(
  `Pages statiques : ${catalogue.pistes.length} piste(s), ${catalogue.albums.length} album(s), ` +
    `404.html, sitemap.xml et robots.txt (${urlSite}).`,
);
