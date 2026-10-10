// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { expect, type Page } from '@playwright/test';
import { crc32, deflateSync } from 'node:zlib';

export const JETON_TEST = 'github_pat_FAUX_JETON_DE_TEST';

const encodeur = new TextEncoder();
const base64 = (texte: string): string => Buffer.from(encodeur.encode(texte)).toString('base64');

/** Fichiers du dépôt simulé : chemin, empreinte, contenu texte éventuel. */
interface FichierSimule {
  chemin: string;
  sha: string;
  contenu?: string;
}

const FICHIERS: FichierSimule[] = [
  { chemin: 'public/musique/ambient/brume.mp3', sha: 'm-brume' },
  { chemin: 'public/musique/ambient/brume.webp', sha: 'i-brume' },
  {
    chemin: 'public/musique/ambient/brume.json',
    sha: 'f-brume',
    contenu: JSON.stringify({
      titre: 'Brume',
      hashtags: ['nuit', 'calme'],
      pochette: 'brume.webp',
      visible: false,
    }),
  },
  { chemin: 'public/musique/techno/300.mp3', sha: 'm-300' },
  {
    chemin: 'public/musique/techno/300.json',
    sha: 'f-300',
    contenu: JSON.stringify({
      titre: 'Trois Cents',
      artiste: 'AP3X Records',
      hashtags: ['nuit'],
    }),
  },
  { chemin: 'public/musique/techno/club/01-intro.mp3', sha: 'm-intro' },
  { chemin: 'public/musique/techno/club/cover.webp', sha: 'i-club' },
  {
    chemin: 'public/musique/techno/club/album.json',
    sha: 'a-club',
    contenu: JSON.stringify({
      titre: 'Club',
      artiste: 'AP3X Records',
      date: '2025-06-01',
      pistes: ['01-intro.mp3'],
    }),
  },
];

/** Fiches et pochette de catégories, et une catégorie vide. */
function fichiersCategories(): FichierSimule[] {
  return [
    {
      chemin: 'public/musique/ambient/categorie.json',
      sha: 'c-ambient',
      contenu: JSON.stringify({ nom: 'Ambiance', couleur: '#ffcc00', ordre: 2 }),
    },
    { chemin: 'public/musique/ambient/cover.webp', sha: 'i-cat-ambient' },
    {
      chemin: 'public/musique/techno/categorie.json',
      sha: 'c-techno',
      contenu: JSON.stringify({ nom: 'Techno', description: 'Rythmes rapides', ordre: 1 }),
    },
    {
      chemin: 'public/musique/vide/categorie.json',
      sha: 'c-vide',
      contenu: JSON.stringify({ nom: 'Vide' }),
    },
  ];
}

/** Fichiers supplémentaires : une 2e piste dans l'album Club, et un brouillon d'album incomplet. */
function fichiersEtendus(): FichierSimule[] {
  return [
    { chemin: 'public/musique/techno/club/02-outro.mp3', sha: 'm-outro' },
    {
      chemin: 'public/musique/techno/club/02-outro.json',
      sha: 'f-outro',
      contenu: JSON.stringify({ titre: 'Outro', artiste: 'Invité' }),
    },
    {
      chemin: 'public/musique/techno/club/album.json',
      sha: 'a-club2',
      contenu: JSON.stringify({
        titre: 'Club',
        artiste: 'AP3X Records',
        date: '2025-06-01',
        pistes: ['01-intro.mp3', '02-outro.mp3'],
      }),
    },
    {
      chemin: 'public/musique/ambient/Nuit/album.json',
      sha: 'a-nuit',
      contenu: JSON.stringify({
        titre: 'Nuit',
        visible: false,
        pistes: ['lune.mp3', 'aube.mp3'],
      }),
    },
    { chemin: 'public/musique/ambient/Nuit/lune.mp3', sha: 'm-lune' },
  ];
}

export interface CommitRecu {
  message: string;
  /** Chemins de l'arbre envoyé, avec le contenu texte des blobs correspondants. */
  fichiers: { chemin: string; contenu: Buffer | null; sha: string | null }[];
}

export interface DepotSimule {
  commits: CommitRecu[];
  /** Nombre d'appels `git/trees?recursive` (lectures de l'arbre). */
  lecturesArbre: () => number;
}

interface OptionsDepot {
  /** Ajoute une 2e piste à l'album Club et un brouillon d'album incomplet. */
  etendu?: boolean;
  /** Ajoute des fiches de catégories (ordre, couleur) et une catégorie vide. */
  categories?: boolean;
  /** Numéros (à partir de 1) des mises à jour de référence qui échouent par une coupure réseau. */
  echecsReference?: number[];
  /** Réponse de la mise à jour de la référence (422 simule une branche qui a avancé). */
  statutReference?: number;
}

/** Simule l'API GitHub avec un petit dépôt : lecture, arbre, blobs et commits groupés. */
export async function simulerDepot(page: Page, options: OptionsDepot = {}): Promise<DepotSimule> {
  const commits: CommitRecu[] = [];
  const blobs = new Map<string, Buffer>();
  let lecturesArbre = 0;
  let appelsReference = 0;
  const supplements = [
    ...(options.etendu === true ? fichiersEtendus() : []),
    ...(options.categories === true ? fichiersCategories() : []),
  ];
  const fichiers: FichierSimule[] = [
    ...FICHIERS.filter((f) => !supplements.some((e) => e.chemin === f.chemin)),
    ...supplements,
  ];
  let numeroBlob = 0;
  let arbreEnvoye: { path: string; sha: string | null }[] = [];
  let messageEnvoye = '';

  await page.route('https://api.github.com/**', async (route) => {
    const requete = route.request();
    const cors = {
      'access-control-allow-origin': '*',
      'access-control-allow-headers': '*',
      'access-control-allow-methods': '*',
    };
    if (requete.method() === 'OPTIONS') {
      await route.fulfill({ status: 204, headers: cors });
      return;
    }
    if (requete.headers()['authorization'] !== `Bearer ${JETON_TEST}`) {
      await route.fulfill({ status: 401, headers: cors, json: {} });
      return;
    }
    const url = new URL(requete.url());
    const cle = `${requete.method()} ${url.pathname}${url.search}`;
    const racine = '/repos/ap3demak-rgb/Ap3X';
    const json = (donnees: unknown, status = 200) =>
      route.fulfill({ status, headers: cors, json: donnees });

    if (cle === 'GET /user') return json({ login: 'ap3x-test' });
    if (cle === `GET ${racine}`) return json({ permissions: { push: true } });
    if (url.pathname.endsWith('/runs')) return json({ workflow_runs: [] });
    if (cle === `GET ${racine}/git/trees/main?recursive=1`) {
      lecturesArbre += 1;
      return json({
        truncated: false,
        tree: fichiers.map((f) => ({ path: f.chemin, type: 'blob', sha: f.sha, size: 10 })),
      });
    }
    const lectureBlob = /\/git\/blobs\/(.+)$/.exec(url.pathname);
    if (requete.method() === 'GET' && lectureBlob !== null) {
      const fichier = fichiers.find((f) => f.sha === lectureBlob[1]);
      return json({ content: base64(fichier?.contenu ?? '') });
    }
    if (cle === `GET ${racine}/git/ref/heads/main`) return json({ object: { sha: 'tete' } });
    if (cle === `GET ${racine}/git/commits/tete`) return json({ tree: { sha: 'arbre0' } });
    if (cle === `POST ${racine}/git/blobs`) {
      numeroBlob += 1;
      const sha = `nouveau-${numeroBlob}`;
      const corps = JSON.parse(requete.postData() ?? '{}') as { content: string };
      blobs.set(sha, Buffer.from(corps.content, 'base64'));
      return json({ sha });
    }
    if (cle === `POST ${racine}/git/trees`) {
      arbreEnvoye = (JSON.parse(requete.postData() ?? '{}') as { tree: typeof arbreEnvoye }).tree;
      return json({ sha: 'arbre1' });
    }
    if (cle === `POST ${racine}/git/commits`) {
      messageEnvoye = (JSON.parse(requete.postData() ?? '{}') as { message: string }).message;
      return json({ sha: 'commit1' });
    }
    if (cle === `PATCH ${racine}/git/refs/heads/main`) {
      appelsReference += 1;
      if (options.echecsReference?.includes(appelsReference) === true) {
        await route.abort('connectionfailed');
        return;
      }
      const statut = options.statutReference ?? 200;
      if (statut === 200) {
        commits.push({
          message: messageEnvoye,
          fichiers: arbreEnvoye.map((e) => ({
            chemin: e.path,
            contenu: e.sha === null ? null : (blobs.get(e.sha) ?? null),
            sha: e.sha,
          })),
        });
      }
      return json({}, statut);
    }
    return json({}, 404);
  });
  return { commits, lecturesArbre: () => lecturesArbre };
}

// --- Fichiers de test --------------------------------------------------------------------------

function synchsafe(n: number): number[] {
  return [(n >> 21) & 0x7f, (n >> 14) & 0x7f, (n >> 7) & 0x7f, n & 0x7f];
}

/** Petit MP3 factice : un tag ID3v2.4 (UTF-8) suivi d'octets quelconques. */
export function mp3AvecTags(tags: Record<string, string>): Buffer {
  const trames = Object.entries(tags).flatMap(([id, valeur]) => {
    const corps = [3, ...encodeur.encode(valeur)];
    return [...encodeur.encode(id), ...synchsafe(corps.length), 0, 0, ...corps];
  });
  return Buffer.from([
    0x49,
    0x44,
    0x33,
    4,
    0,
    0,
    ...synchsafe(trames.length),
    ...trames,
    ...new Array<number>(256).fill(0xff),
  ]);
}

/** PNG valide de 4 × 4 pixels (image unie), construit sans dépendance. */
export function pngDeTest(): Buffer {
  const morceau = (type: string, donnees: Buffer): Buffer => {
    const longueur = Buffer.alloc(4);
    longueur.writeUInt32BE(donnees.length);
    const corps = Buffer.concat([Buffer.from(type, 'ascii'), donnees]);
    const somme = Buffer.alloc(4);
    somme.writeUInt32BE(crc32(corps));
    return Buffer.concat([longueur, corps, somme]);
  };
  const entete = Buffer.alloc(13);
  entete.writeUInt32BE(4, 0);
  entete.writeUInt32BE(4, 4);
  entete[8] = 8; // profondeur de 8 bits
  entete[9] = 2; // couleurs RVB
  const ligne = Buffer.concat([Buffer.from([0]), Buffer.alloc(4 * 3, 0x80)]);
  const pixels = deflateSync(Buffer.concat(Array.from({ length: 4 }, () => ligne)));
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    morceau('IHDR', entete),
    morceau('IDAT', pixels),
    morceau('IEND', Buffer.alloc(0)),
  ]);
}

/** Ouvre l'administration déjà connectée, sur la section demandée. */
export async function ouvrirAdmin(page: Page, section: 'Tracks' | 'New track'): Promise<void> {
  await page.goto('./#/admin');
  await page.evaluate((j) => sessionStorage.setItem('ap3x.admin.jeton', j), JETON_TEST);
  await page.reload();
  await expect(page.getByText('Signed in as ap3x-test.')).toBeVisible();
  await page
    .getByRole('navigation', { name: 'Administration sections' })
    .getByRole('button', { name: section })
    .click();
}
