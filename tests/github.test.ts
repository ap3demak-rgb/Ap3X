// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import {
  ClientGitHub,
  ErreurGitHub,
  TAILLE_MAX_FICHIER,
  depuisBase64,
  verifierJeton,
  versBase64,
} from '../src/admin/github';
import {
  effacerJeton,
  enregistrerJeton,
  jetonSurAppareil,
  lireJeton,
  nettoyerJeton,
  type Stockages,
} from '../src/admin/session';

interface Appel {
  methode: string;
  chemin: string;
  corps: unknown;
  entetes: Record<string, string>;
}

type Reponse = { statut?: number; json?: unknown; entetes?: Record<string, string> };

/** Faux `fetch` : `routes` associe « METHODE /chemin » à une réponse (ou une fonction qui la calcule). */
function fauxFetch(routes: Record<string, Reponse | ((appel: Appel) => Reponse)>) {
  const appels: Appel[] = [];
  const f = ((entree: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(entree));
    const appel: Appel = {
      methode: init?.method ?? 'GET',
      chemin: url.pathname + url.search,
      corps: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      entetes: (init?.headers ?? {}) as Record<string, string>,
    };
    appels.push(appel);
    const route = routes[`${appel.methode} ${appel.chemin}`];
    if (route === undefined)
      throw new TypeError(`Route non simulée : ${appel.methode} ${appel.chemin}`);
    const r = typeof route === 'function' ? route(appel) : route;
    const statut = r.statut ?? 200;
    return Promise.resolve(
      new Response(JSON.stringify(r.json ?? {}), { status: statut, headers: r.entetes }),
    );
  }) as typeof fetch;
  return { f, appels };
}

const DEPOT = '/repos/ap3demak-rgb/Ap3X';

describe('base64', () => {
  it('fait l’aller-retour sur des octets quelconques, y compris un gros tableau', () => {
    const octets = new Uint8Array(100_000).map((_, i) => i % 256);
    expect(depuisBase64(versBase64(octets))).toEqual(octets);
  });
});

describe('ClientGitHub : vérification du jeton', () => {
  it('envoie le jeton dans l’en-tête et renvoie le compte si le droit d’écriture est là', async () => {
    const { f, appels } = fauxFetch({
      'GET /user': { json: { login: 'ap3x' } },
      [`GET ${DEPOT}`]: { json: { permissions: { push: true } } },
    });
    const utilisateur = await verifierJeton(new ClientGitHub({ jeton: 'secret', fetch: f }));
    expect(utilisateur).toEqual({ login: 'ap3x' });
    expect(appels[0]?.entetes['Authorization']).toBe('Bearer secret');
  });

  it('refuse un jeton sans droit d’écriture', async () => {
    const { f } = fauxFetch({
      'GET /user': { json: { login: 'ap3x' } },
      [`GET ${DEPOT}`]: { json: { permissions: { push: false } } },
    });
    await expect(verifierJeton(new ClientGitHub({ jeton: 'x', fetch: f }))).rejects.toMatchObject({
      code: 'droit',
    });
  });

  it('classe les erreurs : jeton, droit, introuvable, conflit, limite, autre', async () => {
    const codes: [number, Record<string, string> | undefined, string][] = [
      [401, undefined, 'jeton'],
      [403, undefined, 'droit'],
      [404, undefined, 'introuvable'],
      [409, undefined, 'conflit'],
      [422, undefined, 'conflit'],
      [429, undefined, 'limite'],
      [403, { 'x-ratelimit-remaining': '0' }, 'limite'],
      [500, undefined, 'autre'],
    ];
    for (const [statut, entetes, attendu] of codes) {
      const { f } = fauxFetch({ 'GET /user': { statut, entetes } });
      const erreur = await new ClientGitHub({ jeton: 'x', fetch: f }).utilisateur().catch((e) => e);
      expect(erreur).toBeInstanceOf(ErreurGitHub);
      expect((erreur as ErreurGitHub).code).toBe(attendu);
    }
  });

  it('indique le délai d’attente quand GitHub le donne', async () => {
    const { f } = fauxFetch({ 'GET /user': { statut: 429, entetes: { 'retry-after': '42' } } });
    const erreur = (await new ClientGitHub({ jeton: 'x', fetch: f })
      .utilisateur()
      .catch((e) => e)) as ErreurGitHub;
    expect(erreur.reessayerApres).toBe(42);
  });

  it('convertit une panne réseau et ne divulgue jamais le jeton dans le message', async () => {
    const f = (() => Promise.reject(new TypeError('Failed to fetch'))) as typeof fetch;
    const erreur = (await new ClientGitHub({ jeton: 'ghp_secretsecret', fetch: f })
      .utilisateur()
      .catch((e) => e)) as ErreurGitHub;
    expect(erreur.code).toBe('reseau');
    expect(erreur.message).not.toContain('ghp_secretsecret');
  });
});

describe('ClientGitHub : fichiers', () => {
  it('liste un dossier', async () => {
    const { f } = fauxFetch({
      [`GET ${DEPOT}/contents/public/musique?ref=main`]: {
        json: [{ name: 'techno', path: 'public/musique/techno', type: 'dir', sha: 'a', size: 0 }],
      },
    });
    const liste = await new ClientGitHub({ jeton: 'x', fetch: f }).lister('public/musique');
    expect(liste).toEqual([
      { nom: 'techno', chemin: 'public/musique/techno', type: 'dir', sha: 'a', taille: 0 },
    ]);
  });

  it('lit un fichier (accents dans le chemin encodés) et renvoie undefined s’il est absent', async () => {
    const texte = new TextEncoder().encode('{"a":1}');
    const { f } = fauxFetch({
      [`GET ${DEPOT}/contents/public/musique/caf%C3%A9.json?ref=main`]: {
        json: { sha: 's1', content: versBase64(texte), encoding: 'base64' },
      },
      [`GET ${DEPOT}/contents/absent.json?ref=main`]: { statut: 404 },
    });
    const client = new ClientGitHub({ jeton: 'x', fetch: f });
    const lu = await client.lire('public/musique/café.json');
    expect(lu?.sha).toBe('s1');
    expect(new TextDecoder().decode(lu?.contenu)).toBe('{"a":1}');
    expect(await client.lire('absent.json')).toBeUndefined();
  });

  it('lit un gros fichier par son blob quand le contenu n’est pas renvoyé', async () => {
    const { f, appels } = fauxFetch({
      [`GET ${DEPOT}/contents/gros.bin?ref=main`]: {
        json: { sha: 'g1', content: '', encoding: 'none' },
      },
      [`GET ${DEPOT}/git/blobs/g1`]: { json: { content: versBase64(new Uint8Array([1, 2, 3])) } },
    });
    const lu = await new ClientGitHub({ jeton: 'x', fetch: f }).lire('gros.bin');
    expect(Array.from(lu?.contenu ?? [])).toEqual([1, 2, 3]);
    expect(appels).toHaveLength(2);
  });

  it('écrit avec le sha de la version modifiée et signale un conflit', async () => {
    const { f, appels } = fauxFetch({
      [`PUT ${DEPOT}/contents/a.json`]: (appel) =>
        (appel.corps as { sha?: string }).sha === 'ancien' ? { statut: 409 } : { json: {} },
    });
    const client = new ClientGitHub({ jeton: 'x', fetch: f });
    await client.ecrire('a.json', '{}', 'ajout: a');
    await expect(client.ecrire('a.json', '{}', 'ajout: a', 'ancien')).rejects.toMatchObject({
      code: 'conflit',
    });
    expect(appels[0]?.corps).toMatchObject({
      message: 'ajout: a',
      branch: 'main',
      content: 'e30=',
    });
  });

  it('supprime un fichier à partir de son sha', async () => {
    const { f, appels } = fauxFetch({ [`DELETE ${DEPOT}/contents/a.json`]: { json: {} } });
    await new ClientGitHub({ jeton: 'x', fetch: f }).supprimer('a.json', 's9', 'suppression: a');
    expect(appels[0]?.corps).toEqual({ message: 'suppression: a', sha: 's9', branch: 'main' });
  });

  it('refuse un fichier de plus de 100 Mo sans appeler GitHub', async () => {
    const { f, appels } = fauxFetch({});
    const trop = { length: TAILLE_MAX_FICHIER + 1 } as unknown as Uint8Array;
    await expect(
      new ClientGitHub({ jeton: 'x', fetch: f }).ecrire('gros.mp3', trop, 'ajout'),
    ).rejects.toMatchObject({ code: 'taille' });
    expect(appels).toHaveLength(0);
  });
});

describe('ClientGitHub : commit groupé', () => {
  function serveurGit(refPatch: Reponse = { json: {} }) {
    let numeroBlob = 0;
    return fauxFetch({
      [`GET ${DEPOT}/git/ref/heads/main`]: { json: { object: { sha: 'tete' } } },
      [`GET ${DEPOT}/git/commits/tete`]: { json: { tree: { sha: 'arbre0' } } },
      [`POST ${DEPOT}/git/blobs`]: () => {
        numeroBlob += 1;
        return { json: { sha: `blob${numeroBlob}` } };
      },
      [`POST ${DEPOT}/git/trees`]: { json: { sha: 'arbre1' } },
      [`POST ${DEPOT}/git/commits`]: { json: { sha: 'commit1' } },
      [`PATCH ${DEPOT}/git/refs/heads/main`]: refPatch,
    });
  }

  it('envoie les fichiers en un seul commit, supprime sans blob et rapporte la progression', async () => {
    const { f, appels } = serveurGit();
    const progres: [number, number][] = [];
    const sha = await new ClientGitHub({ jeton: 'x', fetch: f }).commit(
      'ajout: une piste',
      [
        { chemin: 'public/musique/x/a.mp3', contenu: new Uint8Array([1, 2]) },
        { chemin: 'public/musique/x/a.json', contenu: '{}' },
        { chemin: 'public/musique/x/vieux.json', supprimer: true },
      ],
      (envoyes, total) => progres.push([envoyes, total]),
    );
    expect(sha).toBe('commit1');
    expect(progres).toEqual([
      [0, 3],
      [1, 3],
      [2, 3],
      [3, 3],
    ]);
    expect(appels.filter((a) => a.chemin.endsWith('/git/blobs'))).toHaveLength(2);
    const arbre = appels.find((a) => a.chemin.endsWith('/git/trees'))?.corps;
    expect(arbre).toEqual({
      base_tree: 'arbre0',
      tree: [
        { path: 'public/musique/x/a.mp3', mode: '100644', type: 'blob', sha: 'blob1' },
        { path: 'public/musique/x/a.json', mode: '100644', type: 'blob', sha: 'blob2' },
        { path: 'public/musique/x/vieux.json', mode: '100644', type: 'blob', sha: null },
      ],
    });
    expect(
      appels.find((a) => a.chemin.endsWith('/git/commits') && a.methode === 'POST')?.corps,
    ).toEqual({
      message: 'ajout: une piste',
      tree: 'arbre1',
      parents: ['tete'],
    });
    expect(appels.at(-1)?.corps).toEqual({ sha: 'commit1', force: false });
  });

  it('signale un conflit si la branche a avancé, sans forcer', async () => {
    const { f } = serveurGit({ statut: 422 });
    await expect(
      new ClientGitHub({ jeton: 'x', fetch: f }).commit('m', [{ chemin: 'a', contenu: 'a' }]),
    ).rejects.toMatchObject({ code: 'conflit' });
  });

  it('refuse un commit vide', async () => {
    const { f } = serveurGit();
    await expect(new ClientGitHub({ jeton: 'x', fetch: f }).commit('m', [])).rejects.toThrow();
  });
});

describe('ClientGitHub : déploiement', () => {
  const route = `GET ${DEPOT}/actions/workflows/deploy.yml/runs?branch=main&per_page=1`;
  const execution = (status: string, conclusion: string | null) => ({
    json: {
      workflow_runs: [
        { status, conclusion, html_url: 'https://github.com/x', head_sha: 'abc', created_at: 'd' },
      ],
    },
  });

  it('traduit l’état du workflow', async () => {
    const etats: [string, string | null, string][] = [
      ['in_progress', null, 'en_cours'],
      ['queued', null, 'en_cours'],
      ['completed', 'success', 'termine'],
      ['completed', 'failure', 'echec'],
      ['completed', 'cancelled', 'echec'],
    ];
    for (const [status, conclusion, attendu] of etats) {
      const { f } = fauxFetch({ [route]: execution(status, conclusion) });
      const d = await new ClientGitHub({ jeton: 'x', fetch: f }).dernierDeploiement();
      expect(d?.etat).toBe(attendu);
      expect(d?.commit).toBe('abc');
    }
  });

  it('renvoie undefined quand aucun déploiement n’a eu lieu', async () => {
    const { f } = fauxFetch({ [route]: { json: { workflow_runs: [] } } });
    expect(await new ClientGitHub({ jeton: 'x', fetch: f }).dernierDeploiement()).toBeUndefined();
  });
});

describe('session du jeton', () => {
  class Memoire {
    donnees = new Map<string, string>();
    getItem(cle: string): string | null {
      return this.donnees.get(cle) ?? null;
    }
    setItem(cle: string, valeur: string): void {
      this.donnees.set(cle, valeur);
    }
    removeItem(cle: string): void {
      this.donnees.delete(cle);
    }
  }
  const creer = (): Stockages & { session: Memoire; local: Memoire } => ({
    session: new Memoire(),
    local: new Memoire(),
  });

  it('garde le jeton dans l’onglet par défaut, sur l’appareil sur demande, jamais aux deux endroits', () => {
    const s = creer();
    enregistrerJeton('a', false, s);
    expect(s.session.donnees.size).toBe(1);
    expect(s.local.donnees.size).toBe(0);
    expect(lireJeton(s)).toBe('a');
    expect(jetonSurAppareil(s)).toBe(false);

    enregistrerJeton('b', true, s);
    expect(s.session.donnees.size).toBe(0);
    expect(s.local.donnees.size).toBe(1);
    expect(lireJeton(s)).toBe('b');
    expect(jetonSurAppareil(s)).toBe(true);
  });

  it('la déconnexion efface les deux stockages', () => {
    const s = creer();
    enregistrerJeton('a', true, s);
    effacerJeton(s);
    expect(lireJeton(s)).toBeUndefined();
    expect(s.local.donnees.size + s.session.donnees.size).toBe(0);
  });

  it('survit à un stockage qui lève des exceptions', () => {
    const casse = {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('bloqué');
      },
      removeItem: () => {
        throw new Error('bloqué');
      },
    };
    const s = { session: casse, local: casse };
    expect(() => enregistrerJeton('a', false, s)).not.toThrow();
    expect(lireJeton(s)).toBeUndefined();
    expect(() => effacerJeton(s)).not.toThrow();
    expect(jetonSurAppareil(s)).toBe(false);
  });

  it('nettoie la saisie et refuse un jeton vide ou contenant des espaces', () => {
    expect(nettoyerJeton('  github_pat_abc \n')).toBe('github_pat_abc');
    expect(nettoyerJeton('   ')).toBeUndefined();
    expect(nettoyerJeton('deux mots')).toBeUndefined();
  });
});
