// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/**
 * Pages statiques générées au build. Le site utilise des routes par hash, que les robots (Facebook,
 * Discord, Twitter…) ne lisent pas et dont ils n'exécutent pas le JavaScript : chaque piste et chaque
 * album reçoit donc une petite page avec ses balises Open Graph, qui redirige vers l'application.
 */

export type Traductions = Readonly<Record<string, Readonly<Record<string, string>>>>;

export interface Couleurs {
  fond: string;
  texte: string;
  accent: string;
}

export interface PagePartage {
  titre: string;
  description: string;
  /** Adresse absolue de l'image d'aperçu. */
  image: string;
  /** Adresse absolue canonique de la page de partage. */
  urlPage: string;
  type: 'music.song' | 'music.album';
  /** Grande carte Twitter seulement si l'image est une vraie pochette (pas l'icône du site). */
  grandeImage: boolean;
  /** Route de l'application, par exemple `#/piste/mon-id`. */
  route: string;
  /** Chemin relatif de la page de partage vers la racine du site, par exemple `../../../`. */
  racine: string;
  nomSite: string;
}

/** Échappe un texte pour l'insérer dans du HTML ou dans un attribut entre guillemets. */
export function echapperHtml(texte: string): string {
  return texte
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

/** Sérialise une valeur pour un `<script>` : JSON sûr, sans séquence capable de fermer la balise. */
export function pourScript(valeur: unknown): string {
  return JSON.stringify(valeur)
    .replaceAll('<', '\\u003c')
    .replaceAll('>', '\\u003e')
    .replaceAll('&', '\\u0026')
    .replaceAll(' ', '\\u2028')
    .replaceAll(' ', '\\u2029');
}

/** Adresse absolue d'un chemin relatif au site (déjà encodé segment par segment). */
export function urlAbsolue(urlSite: string, chemin: string): string {
  return `${urlSite.replace(/\/*$/, '/')}${chemin.replace(/^\/+/, '')}`;
}

/** Chemin d'une page de partage relatif au site : `partage/piste/<id>/` (identifiant encodé). */
export function cheminPartage(type: 'piste' | 'album', id: string): string {
  return `partage/${type}/${encodeURIComponent(id)}/`;
}

const STYLE = (c: Couleurs): string =>
  `body{margin:0;min-height:100vh;display:grid;place-items:center;background:${c.fond};color:${c.texte};` +
  `font-family:system-ui,sans-serif;line-height:1.5}main{padding:2rem;max-width:36rem}` +
  `a{color:${c.accent};font-weight:700}`;

/** Script qui traduit les éléments `data-i18n` selon la langue du navigateur (anglais par défaut). */
function scriptTraduction(traductions: Traductions): string {
  return (
    `var T=${pourScript(traductions)};var L=(navigator.languages||[navigator.language||'en']);` +
    `var l='en';for(var i=0;i<L.length;i++){var c=String(L[i]).toLowerCase().split('-')[0];if(T[c]){l=c;break}}` +
    `document.documentElement.lang=l;var e=document.querySelectorAll('[data-i18n]');` +
    `for(var j=0;j<e.length;j++){var k=e[j].getAttribute('data-i18n');if(T[l]&&T[l][k])e[j].textContent=T[l][k]}`
  );
}

function meta(
  propriete: string,
  contenu: string,
  attribut: 'property' | 'name' = 'property',
): string {
  return `<meta ${attribut}="${propriete}" content="${echapperHtml(contenu)}" />`;
}

/** Page de partage d'une piste ou d'un album : balises Open Graph et Twitter, puis redirection. */
export function pageDePartage(
  page: PagePartage,
  couleurs: Couleurs,
  traductions: Traductions,
): string {
  const cible = `${page.racine}${page.route}`;
  return `<!doctype html>
<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- © 2026 AP3X Records -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <title>${echapperHtml(page.titre)}</title>
    ${meta('description', page.description, 'name')}
    <link rel="canonical" href="${echapperHtml(page.urlPage)}" />
    ${meta('og:site_name', page.nomSite)}
    ${meta('og:type', page.type)}
    ${meta('og:title', page.titre)}
    ${meta('og:description', page.description)}
    ${meta('og:url', page.urlPage)}
    ${meta('og:image', page.image)}
    ${meta('twitter:card', page.grandeImage ? 'summary_large_image' : 'summary', 'name')}
    ${meta('twitter:title', page.titre, 'name')}
    ${meta('twitter:description', page.description, 'name')}
    ${meta('twitter:image', page.image, 'name')}
    <noscript><meta http-equiv="refresh" content="0;url=${echapperHtml(cible)}" /></noscript>
    <style>${STYLE(couleurs)}</style>
  </head>
  <body>
    <main>
      <h1>${echapperHtml(page.titre)}</h1>
      <p>${echapperHtml(page.description)}</p>
      <p><a href="${echapperHtml(cible)}" data-i18n="partage.ouvrir">Open in ${echapperHtml(page.nomSite)}</a></p>
    </main>
    <script>
      ${scriptTraduction(traductions)}
      location.replace(${pourScript(page.racine)} + ${pourScript(page.route)} + location.search);
    </script>
  </body>
</html>
`;
}

/** Page 404 : redirection immédiate vers l'accueil, avec un lien traduit si la redirection échoue. */
export function page404(base: string, couleurs: Couleurs, traductions: Traductions): string {
  return `<!doctype html>
<!-- SPDX-License-Identifier: GPL-3.0-or-later -->
<!-- © 2026 AP3X Records -->
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta name="color-scheme" content="dark" />
    <meta name="robots" content="noindex" />
    <meta http-equiv="refresh" content="0;url=${echapperHtml(base)}" />
    <title>Page not found</title>
    <style>${STYLE(couleurs)}</style>
  </head>
  <body>
    <main>
      <h1 data-i18n="erreur.404.titre">Page not found</h1>
      <p data-i18n="erreur.404.message">Taking you back to the home page…</p>
      <p><a href="${echapperHtml(base)}" data-i18n="erreur.404.lien">Go to the home page</a></p>
    </main>
    <script>
      ${scriptTraduction(traductions)}
      location.replace(${pourScript(base)});
    </script>
  </body>
</html>
`;
}

/** Plan du site (sitemap.xml) : les adresses absolues données, sans doublon. */
export function planDuSite(urls: readonly string[]): string {
  const lignes = [...new Set(urls)].map((url) => `  <url><loc>${echapperHtml(url)}</loc></url>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${lignes.join('\n')}\n</urlset>\n`;
}

/** robots.txt : tout est indexable, avec le plan du site. */
export function robots(urlSite: string): string {
  return `User-agent: *\nAllow: /\n\nSitemap: ${urlAbsolue(urlSite, 'sitemap.xml')}\n`;
}
