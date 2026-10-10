// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Dépôt géré par la page d'administration. */
export interface Depot {
  proprietaire: string;
  nom: string;
  branche: string;
}

export const DEPOT: Depot = { proprietaire: 'ap3demak-rgb', nom: 'Ap3X', branche: 'main' };

/** Taille maximale d'un fichier accepté par GitHub (100 Mo). */
export const TAILLE_MAX_FICHIER = 100 * 1024 * 1024;

const API = 'https://api.github.com';
const FICHIER_WORKFLOW = 'deploy.yml';

export type CodeErreur =
  'jeton' | 'droit' | 'introuvable' | 'conflit' | 'limite' | 'reseau' | 'taille' | 'autre';

/** Échec d'un appel à GitHub ; `code` permet à l'interface d'afficher un message traduit. */
export class ErreurGitHub extends Error {
  constructor(
    message: string,
    readonly code: CodeErreur,
    readonly statut = 0,
    /** Secondes à attendre avant de réessayer (limite de débit). */
    readonly reessayerApres?: number,
  ) {
    super(message);
    this.name = 'ErreurGitHub';
  }
}

export interface Utilisateur {
  login: string;
}

export interface EntreeDossier {
  nom: string;
  chemin: string;
  type: 'file' | 'dir' | 'symlink' | 'submodule';
  sha: string;
  taille: number;
}

export interface FichierLu {
  sha: string;
  contenu: Uint8Array;
}

/** Fichier à écrire dans un commit groupé. */
export interface Ajout {
  chemin: string;
  contenu: Uint8Array | string;
}

/** Fichier à supprimer dans un commit groupé. */
export interface Suppression {
  chemin: string;
  supprimer: true;
}

/**
 * Fichier déjà présent dans le dépôt, placé à un autre chemin sans être renvoyé (déplacement : seul
 * le chemin change, l'empreinte du contenu reste la même).
 */
export interface Reutilisation {
  chemin: string;
  sha: string;
}

export type Changement = Ajout | Suppression | Reutilisation;

/** Avancement d'un envoi : fichiers et octets déjà transmis, sur le total. */
export interface Progression {
  fichiers: number;
  totalFichiers: number;
  octets: number;
  totalOctets: number;
}

export interface EntreeArbre {
  chemin: string;
  type: 'blob' | 'tree' | 'commit';
  sha: string;
  taille: number;
}

export interface ArbreDepot {
  entrees: EntreeArbre[];
  /** GitHub a tronqué la liste : le dépôt est trop gros pour être listé en une fois. */
  tronque: boolean;
}

export interface CommitResume {
  sha: string;
  message: string;
  date: string;
  auteur: string;
  url: string;
  parents: string[];
}

export interface FichierCommit {
  chemin: string;
  /** `added`, `removed`, `modified`, `renamed`… (vocabulaire de GitHub). */
  statut: string;
  /** Empreinte du fichier après le commit. */
  sha: string;
  ancienChemin?: string;
}

export interface DetailCommit {
  sha: string;
  message: string;
  parents: string[];
  fichiers: FichierCommit[];
  /** GitHub plafonne la liste à 300 fichiers : elle est peut-être incomplète. */
  tronque: boolean;
}

export type EtatDeploiement = 'en_cours' | 'termine' | 'echec';

export interface Deploiement {
  etat: EtatDeploiement;
  url: string;
  /** Empreinte du commit déployé. */
  commit: string;
  date: string;
}

export interface OptionsClient {
  jeton: string;
  fetch?: typeof fetch;
  depot?: Depot;
}

const encodeur = new TextEncoder();

/** Octets d'un contenu texte ou binaire. */
function enOctets(contenu: Uint8Array | string): Uint8Array {
  return typeof contenu === 'string' ? encodeur.encode(contenu) : contenu;
}

/** Base64 d'octets, par morceaux pour ne pas dépasser la limite d'arguments de `fromCharCode`. */
export function versBase64(octets: Uint8Array): string {
  let texte = '';
  const MORCEAU = 0x8000;
  for (let debut = 0; debut < octets.length; debut += MORCEAU) {
    texte += String.fromCharCode(...octets.subarray(debut, debut + MORCEAU));
  }
  return btoa(texte);
}

export function depuisBase64(base64: string): Uint8Array {
  const texte = atob(base64.replace(/\s/g, ''));
  const octets = new Uint8Array(texte.length);
  for (let i = 0; i < texte.length; i += 1) octets[i] = texte.charCodeAt(i);
  return octets;
}

/** Chemin encodé segment par segment (les `/` sont conservés). */
function encoderChemin(chemin: string): string {
  return chemin.split('/').map(encodeURIComponent).join('/');
}

function verifierTaille(chemin: string, octets: Uint8Array): void {
  if (octets.length > TAILLE_MAX_FICHIER) {
    throw new ErreurGitHub(`Fichier trop volumineux : ${chemin}`, 'taille');
  }
}

/** Classe une réponse d'erreur de GitHub. */
function erreurDepuisReponse(reponse: Response): ErreurGitHub {
  const statut = reponse.status;
  const restant = reponse.headers.get('x-ratelimit-remaining');
  const apres = reponse.headers.get('retry-after');
  const reinitialisation = reponse.headers.get('x-ratelimit-reset');
  if (statut === 429 || (statut === 403 && (restant === '0' || apres !== null))) {
    let attente: number | undefined;
    if (apres !== null) attente = Number(apres);
    else if (reinitialisation !== null) {
      attente = Math.max(0, Number(reinitialisation) - Math.floor(Date.now() / 1000));
    }
    return new ErreurGitHub(
      'Limite de débit GitHub atteinte',
      'limite',
      statut,
      attente !== undefined && Number.isFinite(attente) ? attente : undefined,
    );
  }
  if (statut === 401) return new ErreurGitHub('Jeton refusé', 'jeton', statut);
  if (statut === 403) return new ErreurGitHub('Droit insuffisant', 'droit', statut);
  if (statut === 404) return new ErreurGitHub('Ressource introuvable', 'introuvable', statut);
  if (statut === 409 || statut === 422) {
    return new ErreurGitHub('Conflit de modification', 'conflit', statut);
  }
  return new ErreurGitHub(`Réponse GitHub inattendue (${statut})`, 'autre', statut);
}

/**
 * Client minimal de l'API REST de GitHub. Le jeton reste dans cet objet : il n'est jamais écrit dans
 * un message d'erreur, une adresse ou la console.
 */
export class ClientGitHub {
  private readonly jeton: string;
  private readonly appeler: typeof fetch;
  private readonly depot: Depot;

  constructor(options: OptionsClient) {
    this.jeton = options.jeton;
    // `fetch` doit être appelé avec `window` comme contexte : on l'enveloppe.
    this.appeler = options.fetch ?? ((entree, init) => fetch(entree, init));
    this.depot = options.depot ?? DEPOT;
  }

  private get racine(): string {
    return `/repos/${this.depot.proprietaire}/${this.depot.nom}`;
  }

  /** Envoie une requête et transforme tout échec en `ErreurGitHub`. */
  private async requete(chemin: string, init: RequestInit = {}): Promise<Response> {
    let reponse: Response;
    try {
      reponse = await this.appeler(`${API}${chemin}`, {
        ...init,
        headers: {
          Accept: 'application/vnd.github+json',
          Authorization: `Bearer ${this.jeton}`,
          'X-GitHub-Api-Version': '2022-11-28',
          ...(init.body === undefined ? {} : { 'Content-Type': 'application/json' }),
          ...init.headers,
        },
      });
    } catch {
      throw new ErreurGitHub('Réseau injoignable', 'reseau');
    }
    if (reponse.ok) return reponse;
    throw erreurDepuisReponse(reponse);
  }

  private async json<T>(chemin: string, init?: RequestInit): Promise<T> {
    const reponse = await this.requete(chemin, init);
    return (await reponse.json()) as T;
  }

  /** Compte propriétaire du jeton (`GET /user`) : échoue si le jeton est invalide. */
  async utilisateur(): Promise<Utilisateur> {
    const donnees = await this.json<{ login: string }>('/user');
    return { login: donnees.login };
  }

  /** Vrai si le jeton peut écrire dans le dépôt. */
  async droitEcriture(): Promise<boolean> {
    const donnees = await this.json<{ permissions?: { push?: boolean } }>(this.racine);
    return donnees.permissions?.push === true;
  }

  async lister(dossier: string): Promise<EntreeDossier[]> {
    const donnees = await this.json<
      { name: string; path: string; type: EntreeDossier['type']; sha: string; size: number }[]
    >(`${this.racine}/contents/${encoderChemin(dossier)}?ref=${this.depot.branche}`);
    return donnees.map((e) => ({
      nom: e.name,
      chemin: e.path,
      type: e.type,
      sha: e.sha,
      taille: e.size,
    }));
  }

  /** Lit un fichier ; renvoie `undefined` s'il n'existe pas. */
  async lire(chemin: string): Promise<FichierLu | undefined> {
    let donnees: { sha: string; content?: string; encoding?: string };
    try {
      donnees = await this.json(
        `${this.racine}/contents/${encoderChemin(chemin)}?ref=${this.depot.branche}`,
      );
    } catch (erreur) {
      if (erreur instanceof ErreurGitHub && erreur.code === 'introuvable') return undefined;
      throw erreur;
    }
    if (donnees.content !== undefined && donnees.content !== '' && donnees.encoding === 'base64') {
      return { sha: donnees.sha, contenu: depuisBase64(donnees.content) };
    }
    // Au-delà de 1 Mo, l'API des contenus ne renvoie plus le fichier : on passe par le blob.
    const blob = await this.json<{ content: string }>(`${this.racine}/git/blobs/${donnees.sha}`);
    return { sha: donnees.sha, contenu: depuisBase64(blob.content) };
  }

  /**
   * Crée ou modifie un fichier dans son propre commit. `sha` est celui de la version modifiée : si le
   * fichier a changé depuis, GitHub refuse et l'erreur est de code `conflit`.
   */
  async ecrire(
    chemin: string,
    contenu: Uint8Array | string,
    message: string,
    sha?: string,
  ): Promise<void> {
    const octets = enOctets(contenu);
    verifierTaille(chemin, octets);
    await this.requete(`${this.racine}/contents/${encoderChemin(chemin)}`, {
      method: 'PUT',
      body: JSON.stringify({
        message,
        content: versBase64(octets),
        branch: this.depot.branche,
        ...(sha === undefined ? {} : { sha }),
      }),
    });
  }

  async supprimer(chemin: string, sha: string, message: string): Promise<void> {
    await this.requete(`${this.racine}/contents/${encoderChemin(chemin)}`, {
      method: 'DELETE',
      body: JSON.stringify({ message, sha, branch: this.depot.branche }),
    });
  }

  /**
   * Un seul commit pour plusieurs fichiers (API Git Data : blobs, arbre, commit, référence).
   * La référence est mise à jour sans forcer : si la branche a avancé entre-temps, l'erreur est de code
   * `conflit` et rien n'est publié (les blobs déjà envoyés restent inoffensifs). Renvoie l'empreinte
   * du nouveau commit. `progression` reçoit le nombre de fichiers déjà envoyés et le total.
   */
  async commit(
    message: string,
    changements: readonly Changement[],
    progression?: (avancement: Progression) => void,
  ): Promise<string> {
    if (changements.length === 0) throw new Error('Aucun changement à publier');
    for (const c of changements) {
      if ('contenu' in c) verifierTaille(c.chemin, enOctets(c.contenu));
    }
    const branche = this.depot.branche;
    const reference = await this.json<{ object: { sha: string } }>(
      `${this.racine}/git/ref/heads/${branche}`,
    );
    const tete = reference.object.sha;
    const commitTete = await this.json<{ tree: { sha: string } }>(
      `${this.racine}/git/commits/${tete}`,
    );

    const arbre: { path: string; mode: '100644'; type: 'blob'; sha: string | null }[] = [];
    const totalOctets = changements.reduce(
      (somme, c) => somme + ('contenu' in c ? enOctets(c.contenu).length : 0),
      0,
    );
    let fichiers = 0;
    let octets = 0;
    const signaler = (): void =>
      progression?.({ fichiers, totalFichiers: changements.length, octets, totalOctets });
    signaler();
    for (const c of changements) {
      if ('supprimer' in c) {
        arbre.push({ path: c.chemin, mode: '100644', type: 'blob', sha: null });
      } else if ('sha' in c) {
        arbre.push({ path: c.chemin, mode: '100644', type: 'blob', sha: c.sha });
      } else {
        const blob = await this.json<{ sha: string }>(`${this.racine}/git/blobs`, {
          method: 'POST',
          body: JSON.stringify({ content: versBase64(enOctets(c.contenu)), encoding: 'base64' }),
        });
        arbre.push({ path: c.chemin, mode: '100644', type: 'blob', sha: blob.sha });
      }
      fichiers += 1;
      if ('contenu' in c) octets += enOctets(c.contenu).length;
      signaler();
    }

    const nouvelArbre = await this.json<{ sha: string }>(`${this.racine}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: commitTete.tree.sha, tree: arbre }),
    });
    const nouveau = await this.json<{ sha: string }>(`${this.racine}/git/commits`, {
      method: 'POST',
      body: JSON.stringify({ message, tree: nouvelArbre.sha, parents: [tete] }),
    });
    await this.requete(`${this.racine}/git/refs/heads/${branche}`, {
      method: 'PATCH',
      body: JSON.stringify({ sha: nouveau.sha, force: false }),
    });
    return nouveau.sha;
  }

  /** Tous les fichiers du dépôt en un seul appel (arbre Git récursif de la branche). */
  async arbre(): Promise<ArbreDepot> {
    const donnees = await this.json<{
      tree: { path: string; type: EntreeArbre['type']; sha: string; size?: number }[];
      truncated: boolean;
    }>(`${this.racine}/git/trees/${this.depot.branche}?recursive=1`);
    return {
      entrees: donnees.tree.map((e) => ({
        chemin: e.path,
        type: e.type,
        sha: e.sha,
        taille: e.size ?? 0,
      })),
      tronque: donnees.truncated,
    };
  }

  /** Contenu d'un blob d'après son empreinte. */
  async lireBlob(sha: string): Promise<Uint8Array> {
    const blob = await this.json<{ content: string }>(`${this.racine}/git/blobs/${sha}`);
    return depuisBase64(blob.content);
  }

  /** Derniers commits de la branche, du plus récent au plus ancien. */
  async historique(nombre = 20): Promise<CommitResume[]> {
    const donnees = await this.json<
      {
        sha: string;
        html_url: string;
        commit: { message: string; author?: { name?: string; date?: string } };
        parents: { sha: string }[];
      }[]
    >(`${this.racine}/commits?sha=${this.depot.branche}&per_page=${nombre}`);
    return donnees.map((c) => ({
      sha: c.sha,
      message: c.commit.message,
      date: c.commit.author?.date ?? '',
      auteur: c.commit.author?.name ?? '',
      url: c.html_url,
      parents: c.parents.map((p) => p.sha),
    }));
  }

  /** Fichiers modifiés par un commit (GitHub en renvoie au plus 300). */
  async detailCommit(sha: string): Promise<DetailCommit> {
    const donnees = await this.json<{
      sha: string;
      commit: { message: string };
      parents: { sha: string }[];
      files?: { filename: string; status: string; sha: string; previous_filename?: string }[];
    }>(`${this.racine}/commits/${sha}`);
    const fichiers = (donnees.files ?? []).map((f) => ({
      chemin: f.filename,
      statut: f.status,
      sha: f.sha,
      ...(f.previous_filename !== undefined && { ancienChemin: f.previous_filename }),
    }));
    return {
      sha: donnees.sha,
      message: donnees.commit.message,
      parents: donnees.parents.map((p) => p.sha),
      fichiers,
      tronque: fichiers.length >= 300,
    };
  }

  /** Empreinte d'un fichier à une révision donnée, ou `undefined` s'il n'existait pas alors. */
  async empreinteA(chemin: string, revision: string): Promise<string | undefined> {
    try {
      const donnees = await this.json<{ sha?: string; type?: string }>(
        `${this.racine}/contents/${encoderChemin(chemin)}?ref=${revision}`,
      );
      return donnees.type === 'file' || donnees.type === undefined ? donnees.sha : undefined;
    } catch (erreur) {
      if (erreur instanceof ErreurGitHub && erreur.code === 'introuvable') return undefined;
      throw erreur;
    }
  }

  /** Dernière exécution du workflow de déploiement, ou `undefined` s'il n'y en a pas encore. */
  async dernierDeploiement(): Promise<Deploiement | undefined> {
    const donnees = await this.json<{
      workflow_runs: {
        status: string;
        conclusion: string | null;
        html_url: string;
        head_sha: string;
        created_at: string;
      }[];
    }>(
      `${this.racine}/actions/workflows/${FICHIER_WORKFLOW}/runs?branch=${this.depot.branche}&per_page=1`,
    );
    const execution = donnees.workflow_runs[0];
    if (execution === undefined) return undefined;
    let etat: EtatDeploiement = 'en_cours';
    if (execution.status === 'completed') {
      etat = execution.conclusion === 'success' ? 'termine' : 'echec';
    }
    return {
      etat,
      url: execution.html_url,
      commit: execution.head_sha,
      date: execution.created_at,
    };
  }
}

/**
 * Vérifie un jeton : il doit être accepté par GitHub et permettre d'écrire dans le dépôt.
 * Renvoie le compte connecté ; sinon lève une `ErreurGitHub` (`jeton`, `droit`, `introuvable`…).
 */
export async function verifierJeton(client: ClientGitHub): Promise<Utilisateur> {
  const utilisateur = await client.utilisateur();
  if (!(await client.droitEcriture())) {
    throw new ErreurGitHub('Le jeton ne permet pas d’écrire dans le dépôt', 'droit', 403);
  }
  return utilisateur;
}
