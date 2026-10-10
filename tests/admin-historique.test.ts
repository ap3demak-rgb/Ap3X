// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import type { DetailCommit, FichierCommit } from '../src/admin/github';
import { ClientGitHub } from '../src/admin/github';
import { cheminsADeterminer, planAnnulation, titreDeCommit } from '../src/admin/historique';

const detail = (
  fichiers: FichierCommit[],
  surcharge: Partial<DetailCommit> = {},
): DetailCommit => ({
  sha: 'c1',
  message: 'modification: réglages du site\n\ncorps',
  parents: ['p1'],
  fichiers,
  tronque: false,
  ...surcharge,
});

const actuel = (entrees: Record<string, string>): ReadonlyMap<string, string> =>
  new Map(Object.entries(entrees));
const avant = (
  entrees: Record<string, string | undefined>,
): ReadonlyMap<string, string | undefined> => new Map(Object.entries(entrees));

describe('annulation d’un commit', () => {
  it('prend la première ligne du message', () => {
    expect(titreDeCommit('a\n\nb')).toBe('a');
    expect(titreDeCommit('')).toBe('');
  });

  it('restaure un fichier modifié par son ancienne empreinte, sans rien renvoyer', () => {
    const plan = planAnnulation(
      detail([{ chemin: 'public/site.json', statut: 'modified', sha: 'apres' }]),
      actuel({ 'public/site.json': 'apres' }),
      avant({ 'public/site.json': 'avant' }),
    );
    expect(plan).toEqual({
      ok: true,
      message: 'annulation: modification: réglages du site',
      changements: [{ chemin: 'public/site.json', sha: 'avant' }],
    });
  });

  it('supprime un fichier ajouté et restaure un fichier supprimé', () => {
    const plan = planAnnulation(
      detail([
        { chemin: 'a.mp3', statut: 'added', sha: 'sa' },
        { chemin: 'b.mp3', statut: 'removed', sha: 'sb' },
      ]),
      actuel({ 'a.mp3': 'sa' }),
      avant({ 'b.mp3': 'sb-avant' }),
    );
    expect(plan).toMatchObject({
      ok: true,
      changements: [
        { chemin: 'a.mp3', supprimer: true },
        { chemin: 'b.mp3', sha: 'sb-avant' },
      ],
    });
  });

  it('annule un renommage : le nouveau chemin disparaît, l’ancien revient', () => {
    const plan = planAnnulation(
      detail([{ chemin: 'nouveau.mp3', statut: 'renamed', sha: 's', ancienChemin: 'ancien.mp3' }]),
      actuel({ 'nouveau.mp3': 's' }),
      avant({ 'ancien.mp3': 'sa' }),
    );
    expect(plan).toMatchObject({
      ok: true,
      changements: [
        { chemin: 'nouveau.mp3', supprimer: true },
        { chemin: 'ancien.mp3', sha: 'sa' },
      ],
    });
  });

  it('refuse quand un fichier a encore changé depuis (rien n’est écrasé)', () => {
    const plan = planAnnulation(
      detail([
        { chemin: 'a.json', statut: 'modified', sha: 'v2' },
        { chemin: 'b.json', statut: 'added', sha: 'v1' },
        { chemin: 'c.json', statut: 'removed', sha: 'v0' },
      ]),
      actuel({ 'a.json': 'v3', 'b.json': 'v1', 'c.json': 'recree' }),
      avant({ 'a.json': 'v1', 'c.json': 'v0' }),
    );
    expect(plan).toEqual({ ok: false, erreur: { code: 'conflit', chemins: ['a.json', 'c.json'] } });
  });

  it('refuse un fichier supprimé ou modifié dont la version précédente est introuvable', () => {
    const plan = planAnnulation(
      detail([{ chemin: 'a.json', statut: 'modified', sha: 'v2' }]),
      actuel({ 'a.json': 'v2' }),
      avant({}),
    );
    expect(plan).toEqual({ ok: false, erreur: { code: 'introuvable', chemins: ['a.json'] } });
  });

  it('refuse un commit de fusion ou trop gros', () => {
    expect(planAnnulation(detail([], { parents: ['p1', 'p2'] }), actuel({}), avant({}))).toEqual({
      ok: false,
      erreur: { code: 'fusion' },
    });
    expect(planAnnulation(detail([], { tronque: true }), actuel({}), avant({}))).toEqual({
      ok: false,
      erreur: { code: 'trop' },
    });
  });

  it('liste les chemins dont l’état précédent est nécessaire', () => {
    expect(
      cheminsADeterminer(
        detail([
          { chemin: 'a', statut: 'added', sha: '1' },
          { chemin: 'b', statut: 'modified', sha: '2' },
          { chemin: 'c', statut: 'removed', sha: '3' },
          { chemin: 'd', statut: 'renamed', sha: '4', ancienChemin: 'e' },
        ]),
      ).sort(),
    ).toEqual(['b', 'c', 'e']);
  });
});

describe('client GitHub : historique', () => {
  const reponses: Record<string, unknown> = {
    '/repos/ap3demak-rgb/Ap3X/commits?sha=main&per_page=2': [
      {
        sha: 'c2',
        html_url: 'https://github.com/x/c2',
        commit: {
          message: 'ajout',
          author: { name: 'AP3X Records', date: '2026-10-10T10:00:00Z' },
        },
        parents: [{ sha: 'c1' }],
      },
    ],
    '/repos/ap3demak-rgb/Ap3X/commits/c2': {
      sha: 'c2',
      commit: { message: 'ajout' },
      parents: [{ sha: 'c1' }],
      files: [
        { filename: 'a.json', status: 'modified', sha: 's' },
        { filename: 'n.mp3', status: 'renamed', sha: 't', previous_filename: 'o.mp3' },
      ],
    },
    '/repos/ap3demak-rgb/Ap3X/contents/a.json?ref=c1': { type: 'file', sha: 'avant' },
  };
  const f = ((entree: RequestInfo | URL) => {
    const url = new URL(String(entree));
    const cle = url.pathname + url.search;
    const donnees = reponses[cle];
    return Promise.resolve(
      donnees === undefined
        ? new Response('{}', { status: 404 })
        : new Response(JSON.stringify(donnees), { status: 200 }),
    );
  }) as typeof fetch;
  const client = new ClientGitHub({ jeton: 'x', fetch: f });

  it('liste les commits, détaille un commit et lit une empreinte passée', async () => {
    expect(await client.historique(2)).toEqual([
      {
        sha: 'c2',
        message: 'ajout',
        date: '2026-10-10T10:00:00Z',
        auteur: 'AP3X Records',
        url: 'https://github.com/x/c2',
        parents: ['c1'],
      },
    ]);
    expect(await client.detailCommit('c2')).toEqual({
      sha: 'c2',
      message: 'ajout',
      parents: ['c1'],
      fichiers: [
        { chemin: 'a.json', statut: 'modified', sha: 's' },
        { chemin: 'n.mp3', statut: 'renamed', sha: 't', ancienChemin: 'o.mp3' },
      ],
      tronque: false,
    });
    expect(await client.empreinteA('a.json', 'c1')).toBe('avant');
    expect(await client.empreinteA('absent.json', 'c1')).toBeUndefined();
  });
});
