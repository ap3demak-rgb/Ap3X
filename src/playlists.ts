// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const CLE_STOCKAGE = 'ap3x.playlists';
/** Longueur maximale du nom d'une playlist. */
export const LONGUEUR_NOM_MAX = 80;

type Stockage = Pick<Storage, 'getItem' | 'setItem'>;

export interface Playlist {
  id: string;
  nom: string;
  pistes: string[];
}

/** Format du fichier d'export / import. */
export interface ExportPlaylists {
  format: 'ap3x-playlists';
  version: 1;
  playlists: Playlist[];
}

// Validation écrite à la main plutôt qu'avec zod : les playlists sont lues dès le démarrage du site,
// et charger zod à ce moment-là retarderait le premier affichage.
const estTexteNonVide = (valeur: unknown): valeur is string =>
  typeof valeur === 'string' && valeur.length > 0;

/** Nom nettoyé (espaces superflus retirés, longueur bornée) ; `undefined` s'il est vide. */
export function nettoyerNom(nom: string): string | undefined {
  const propre = nom.replace(/\s+/g, ' ').trim();
  return propre.length >= 1 && propre.length <= LONGUEUR_NOM_MAX ? propre : undefined;
}

function lirePlaylist(brut: unknown): Playlist | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined;
  const { id, nom, pistes } = brut as Record<string, unknown>;
  if (!estTexteNonVide(id) || typeof nom !== 'string' || !Array.isArray(pistes)) return undefined;
  const propre = nom.trim();
  if (propre.length < 1 || propre.length > LONGUEUR_NOM_MAX) return undefined;
  if (!pistes.every(estTexteNonVide)) return undefined;
  return { id, nom: propre, pistes: [...(pistes as string[])] };
}

/** Liste de playlists valides ; `undefined` si la valeur n'est pas une liste ou si un élément est invalide. */
function lirePlaylists(brut: unknown): Playlist[] | undefined {
  if (!Array.isArray(brut)) return undefined;
  const listes = brut.map(lirePlaylist);
  return listes.every((p): p is Playlist => p !== undefined) ? listes : undefined;
}

function lireExport(brut: unknown): ExportPlaylists | undefined {
  if (typeof brut !== 'object' || brut === null) return undefined;
  const { format, version, playlists } = brut as Record<string, unknown>;
  if (format !== 'ap3x-playlists' || version !== 1) return undefined;
  const listes = lirePlaylists(playlists);
  return listes === undefined ? undefined : { format, version, playlists: listes };
}

/** Premier nom libre « Nom », « Nom (2) », « Nom (3) »… parmi les noms déjà pris (sans tenir compte de la casse). */
export function nomDisponible(nom: string, pris: readonly string[]): string {
  const minuscules = new Set(pris.map((p) => p.toLocaleLowerCase()));
  if (!minuscules.has(nom.toLocaleLowerCase())) return nom;
  for (let n = 2; ; n += 1) {
    const candidat = `${nom} (${n})`;
    if (!minuscules.has(candidat.toLocaleLowerCase())) return candidat;
  }
}

function nouvelIdentifiant(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID();
  return `pl-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export interface ResultatImport {
  /** Nombre de playlists ajoutées. */
  ajoutees: number;
}

export class ImportInvalide extends Error {
  constructor() {
    super('Fichier de playlists invalide');
    this.name = 'ImportInvalide';
  }
}

/**
 * Playlists du visiteur, conservées dans le navigateur (localStorage).
 * Événement : `change` à chaque modification, y compris venant d'un autre onglet.
 */
export class Playlists extends EventTarget {
  private listes: Playlist[] = [];
  private readonly stockage: Stockage | undefined;
  private readonly fabriqueId: () => string;

  constructor(stockage?: Stockage, fabriqueId: () => string = nouvelIdentifiant) {
    super();
    this.stockage = stockage;
    this.fabriqueId = fabriqueId;
    this.recharger(false);
  }

  toutes(): readonly Playlist[] {
    return this.listes;
  }

  obtenir(id: string): Playlist | undefined {
    return this.listes.find((p) => p.id === id);
  }

  /** Crée une playlist ; renvoie `undefined` si le nom est vide. Un nom déjà pris reçoit un suffixe. */
  creer(nom: string, pistes: readonly string[] = []): Playlist | undefined {
    const propre = nettoyerNom(nom);
    if (propre === undefined) return undefined;
    const playlist: Playlist = {
      id: this.fabriqueId(),
      nom: nomDisponible(
        propre,
        this.listes.map((p) => p.nom),
      ),
      pistes: [...new Set(pistes)],
    };
    this.listes = [...this.listes, playlist];
    this.modifier();
    return playlist;
  }

  /** Renomme une playlist ; `false` si elle n'existe pas ou si le nom est vide. */
  renommer(id: string, nom: string): boolean {
    const propre = nettoyerNom(nom);
    const playlist = this.obtenir(id);
    if (propre === undefined || playlist === undefined) return false;
    const autres = this.listes.filter((p) => p.id !== id).map((p) => p.nom);
    playlist.nom = nomDisponible(propre, autres);
    this.modifier();
    return true;
  }

  supprimer(id: string): boolean {
    if (this.obtenir(id) === undefined) return false;
    this.listes = this.listes.filter((p) => p.id !== id);
    this.modifier();
    return true;
  }

  /** Ajoute des pistes à la fin d'une playlist, sans doublon ; renvoie le nombre de pistes ajoutées. */
  ajouterPistes(id: string, pistes: readonly string[]): number {
    const playlist = this.obtenir(id);
    if (playlist === undefined) return 0;
    const nouvelles = [...new Set(pistes)].filter((p) => !playlist.pistes.includes(p));
    if (nouvelles.length === 0) return 0;
    playlist.pistes = [...playlist.pistes, ...nouvelles];
    this.modifier();
    return nouvelles.length;
  }

  retirerPiste(id: string, index: number): boolean {
    const playlist = this.obtenir(id);
    if (playlist === undefined || index < 0 || index >= playlist.pistes.length) return false;
    playlist.pistes = playlist.pistes.filter((_, i) => i !== index);
    this.modifier();
    return true;
  }

  deplacerPiste(id: string, de: number, vers: number): boolean {
    const playlist = this.obtenir(id);
    const n = playlist?.pistes.length ?? 0;
    if (playlist === undefined || de < 0 || de >= n || vers < 0 || vers >= n || de === vers) {
      return false;
    }
    const pistes = [...playlist.pistes];
    const [piste] = pistes.splice(de, 1);
    if (piste === undefined) return false;
    pistes.splice(vers, 0, piste);
    playlist.pistes = pistes;
    this.modifier();
    return true;
  }

  /** Contenu du fichier d'export (JSON lisible). */
  exporter(): string {
    const contenu: ExportPlaylists = {
      format: 'ap3x-playlists',
      version: 1,
      playlists: this.listes.map((p) => ({ ...p, pistes: [...p.pistes] })),
    };
    return JSON.stringify(contenu, null, 2);
  }

  /**
   * Ajoute les playlists d'un fichier d'export. Les identifiants sont régénérés et les noms déjà pris
   * reçoivent un suffixe : un import ne remplace jamais une playlist existante.
   * Lève `ImportInvalide` si le fichier n'est pas un export valide (rien n'est alors modifié).
   */
  importer(texte: string): ResultatImport {
    let brut: unknown;
    try {
      brut = JSON.parse(texte);
    } catch {
      throw new ImportInvalide();
    }
    const contenu = lireExport(brut);
    if (contenu === undefined) throw new ImportInvalide();
    const noms = this.listes.map((p) => p.nom);
    const importees: Playlist[] = contenu.playlists.map((p) => {
      const nom = nomDisponible(p.nom, noms);
      noms.push(nom);
      return { id: this.fabriqueId(), nom, pistes: [...new Set(p.pistes)] };
    });
    if (importees.length > 0) {
      this.listes = [...this.listes, ...importees];
      this.modifier();
    }
    return { ajoutees: importees.length };
  }

  /** Relit le stockage (par exemple après une modification dans un autre onglet). */
  recharger(notifier = true): void {
    try {
      const brut = this.stockage?.getItem(CLE_STOCKAGE);
      const lu: unknown = brut === null || brut === undefined ? undefined : JSON.parse(brut);
      this.listes = lirePlaylists(lu) ?? [];
    } catch {
      this.listes = [];
    }
    if (notifier) this.dispatchEvent(new Event('change'));
  }

  private modifier(): void {
    try {
      this.stockage?.setItem(CLE_STOCKAGE, JSON.stringify(this.listes));
    } catch {
      // Stockage indisponible : les playlists ne durent que le temps de la visite.
    }
    this.dispatchEvent(new Event('change'));
  }
}

function stockageLocal(): Storage | undefined {
  try {
    return window.localStorage;
  } catch {
    return undefined;
  }
}

/** Playlists de l'application, synchronisées entre les onglets. */
export const playlists = new Playlists(stockageLocal());
window.addEventListener('storage', (evenement) => {
  if (evenement.key === CLE_STOCKAGE || evenement.key === null) playlists.recharger();
});
