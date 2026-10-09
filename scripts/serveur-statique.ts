// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFile } from 'node:fs/promises';
import { createServer, type Server } from 'node:http';
import { extname, join, normalize, sep } from 'node:path';
import { gzipSync } from 'node:zlib';

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.xml': 'application/xml; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.mp3': 'audio/mpeg',
};
const COMPRESSIBLES = new Set([
  '.html',
  '.js',
  '.css',
  '.json',
  '.webmanifest',
  '.svg',
  '.xml',
  '.txt',
]);

/**
 * Serveur statique qui imite GitHub Pages : site servi sous `base`, compression gzip des textes, cache
 * de 10 minutes, `404.html` avec le code 404 pour tout chemin inconnu. Sert aux mesures de performance :
 * `vite preview` ne compresse pas et renverrait des tailles bien supérieures à celles de la production.
 */
export async function demarrerServeurStatique(
  dossier: string,
  base: string,
  port: number,
): Promise<{ serveur: Server; fermer: () => Promise<void> }> {
  const compresses = new Map<string, Buffer>();

  const lire = async (chemin: string): Promise<Buffer | undefined> => {
    try {
      return await readFile(chemin);
    } catch {
      return undefined;
    }
  };

  const serveur = createServer((requete, reponse) => {
    void (async () => {
      const url = new URL(requete.url ?? '/', 'http://localhost');
      let relatif = decodeURIComponent(url.pathname);
      let contenu: Buffer | undefined;
      let extension = '.html';
      let statut = 200;
      if (relatif.startsWith(base)) {
        relatif = relatif.slice(base.length);
        if (relatif === '' || relatif.endsWith('/')) relatif += 'index.html';
        const chemin = normalize(join(dossier, relatif));
        // Interdit de sortir du dossier publié (../).
        if (chemin.startsWith(normalize(dossier) + sep) || chemin === normalize(dossier)) {
          contenu = await lire(chemin);
          extension = extname(chemin).toLowerCase();
        }
      }
      if (contenu === undefined) {
        statut = 404;
        extension = '.html';
        contenu = (await lire(join(dossier, '404.html'))) ?? Buffer.from('Not found');
      }
      const enTetes: Record<string, string | number> = {
        'content-type': TYPES[extension] ?? 'application/octet-stream',
        'cache-control': 'max-age=600',
        'accept-ranges': 'bytes',
      };
      const accepteGzip = String(requete.headers['accept-encoding'] ?? '').includes('gzip');
      if (accepteGzip && COMPRESSIBLES.has(extension)) {
        const cle = `${statut}:${relatif}`;
        let zip = compresses.get(cle);
        if (zip === undefined) {
          zip = gzipSync(contenu);
          compresses.set(cle, zip);
        }
        contenu = zip;
        enTetes['content-encoding'] = 'gzip';
        enTetes['vary'] = 'Accept-Encoding';
      }
      enTetes['content-length'] = contenu.length;
      reponse.writeHead(statut, enTetes);
      reponse.end(requete.method === 'HEAD' ? undefined : contenu);
    })().catch(() => {
      reponse.writeHead(500);
      reponse.end();
    });
  });

  await new Promise<void>((resoudre) => serveur.listen(port, '127.0.0.1', resoudre));
  return {
    serveur,
    fermer: () =>
      new Promise<void>((resoudre) => {
        serveur.closeAllConnections();
        serveur.close(() => resoudre());
      }),
  };
}
