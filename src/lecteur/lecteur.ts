// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { Piste } from '../catalogue/schemas';

export type Repetition = 'aucune' | 'piste' | 'liste';

/** Sous-ensemble de HTMLAudioElement utilisé par le lecteur (permet de le simuler dans les tests). */
export type ElementAudio = EventTarget &
  Pick<
    HTMLAudioElement,
    | 'src'
    | 'currentTime'
    | 'duration'
    | 'volume'
    | 'muted'
    | 'paused'
    | 'preload'
    | 'play'
    | 'pause'
    | 'removeAttribute'
    | 'load'
  > & {
    /** Erreur de média en cours (`HTMLMediaElement.error`) ; absente des éléments simulés. */
    readonly error?: Pick<MediaError, 'code'> | null;
  };

export interface OptionsLecteur {
  audio: ElementAudio;
  /** Second élément audio qui charge à l'avance la piste suivante. */
  prechargeur?: ElementAudio;
  stockage?: Pick<Storage, 'getItem' | 'setItem'>;
  /** Transforme le chemin d'un fichier du catalogue en URL utilisable par l'élément audio. */
  resoudreUrl: (chemin: string) => string;
  /** Vrai si l'utilisateur demande d'économiser les données : la piste suivante n'est alors pas préchargée. */
  economieDonnees?: () => boolean;
  /** Générateur aléatoire dans [0, 1[, remplaçable pour les tests. */
  aleatoire?: () => number;
  /** Lecture aléatoire au premier passage, quand aucune préférence n'est mémorisée. */
  aleatoireParDefaut?: boolean;
}

export interface EtatLecteur {
  piste: Piste | undefined;
  file: readonly Piste[];
  /** Index de la piste courante dans `file` (-1 si aucune). */
  index: number;
  enLecture: boolean;
  position: number;
  duree: number;
  volume: number;
  muet: boolean;
  aleatoire: boolean;
  repetition: Repetition;
  erreur: boolean;
  /** L'erreur vient du réseau (connexion coupée ou interrompue) et non du fichier lui-même. */
  erreurReseau: boolean;
  /** Le navigateur a refusé de démarrer la lecture sans action de l'utilisateur (lecture automatique). */
  lectureBloquee: boolean;
}

interface Memoire {
  volume: number;
  muet: boolean;
  aleatoire: boolean;
  repetition: Repetition;
  derniere?: string;
}

const CLE_STOCKAGE = 'ap3x.lecteur';
/** Au-delà de ce délai, « précédent » revient d'abord au début de la piste. */
const SEUIL_RETOUR_DEBUT = 3;

function borner(valeur: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, valeur));
}

/**
 * Lecteur audio : file d'attente, ordre de lecture (normal ou aléatoire), répétition, volume.
 * Événements : `etat` (tout changement), `piste` (piste courante changée), `file` (file modifiée),
 * `bloquee` (le navigateur a refusé une lecture automatique).
 */
export class Lecteur extends EventTarget {
  private readonly audio: ElementAudio;
  private readonly prechargeur: ElementAudio | undefined;
  private readonly options: OptionsLecteur;
  private file: Piste[] = [];
  /** Ordre de lecture : `ordre[pos]` est l'index dans `file` de la piste courante. */
  private ordre: number[] = [];
  private pos = -1;
  private modeAleatoire = false;
  private modeRepetition: Repetition = 'aucune';
  private enErreur = false;
  private erreurReseau = false;
  private bloquee = false;
  private cheminPrecharge = '';

  constructor(options: OptionsLecteur) {
    super();
    this.options = options;
    this.audio = options.audio;
    this.prechargeur = options.prechargeur;
    this.audio.preload = 'metadata';
    // Aucun MP3 n'est téléchargé tant qu'on n'écoute pas : le préchargeur reste inactif jusqu'à la lecture.
    if (this.prechargeur !== undefined) this.prechargeur.preload = 'none';

    const memoire = this.lireMemoire();
    this.audio.volume = borner(memoire.volume, 0, 1);
    this.audio.muted = memoire.muet;
    this.modeAleatoire = memoire.aleatoire;
    this.modeRepetition = memoire.repetition;

    for (const nom of [
      'timeupdate',
      'durationchange',
      'loadedmetadata',
      'play',
      'playing',
      'pause',
    ]) {
      this.audio.addEventListener(nom, () => this.emettre());
    }
    this.audio.addEventListener('volumechange', () => {
      this.sauvegarder();
      this.emettre();
    });
    this.audio.addEventListener('ended', () => this.finDePiste());
    this.audio.addEventListener('play', () => {
      this.bloquee = false;
      this.preparerSuivante();
    });
    this.audio.addEventListener('error', () => {
      if (this.pisteCourante !== undefined) {
        this.enErreur = true;
        // Code 2 = MEDIA_ERR_NETWORK ; hors connexion, le fichier peut aussi être simplement injoignable.
        this.erreurReseau =
          this.audio.error?.code === 2 ||
          (typeof navigator !== 'undefined' && navigator.onLine === false);
        this.emettre();
      }
    });
  }

  get pisteCourante(): Piste | undefined {
    const index = this.indexCourant();
    return index >= 0 ? this.file[index] : undefined;
  }

  etat(): EtatLecteur {
    const duree = this.audio.duration;
    return {
      piste: this.pisteCourante,
      file: this.file,
      index: this.indexCourant(),
      enLecture: !this.audio.paused,
      position: this.audio.currentTime,
      duree: Number.isFinite(duree) ? duree : (this.pisteCourante?.duree ?? 0),
      volume: this.audio.volume,
      muet: this.audio.muted,
      aleatoire: this.modeAleatoire,
      repetition: this.modeRepetition,
      erreur: this.enErreur,
      erreurReseau: this.enErreur && this.erreurReseau,
      lectureBloquee: this.bloquee,
    };
  }

  /** Remplace la file d'attente et démarre à `indexDepart`. */
  charger(pistes: readonly Piste[], indexDepart = 0, lire = true): void {
    this.file = [...pistes];
    if (this.file.length === 0) {
      this.arreter();
      this.emettre('file');
      return;
    }
    this.reconstruireOrdre(borner(indexDepart, 0, this.file.length - 1));
    this.lancer(lire);
    this.emettre('file');
  }

  /** Joue la piste d'index `index` de la file. */
  jouerIndex(index: number): void {
    const position = this.ordre.indexOf(index);
    if (position < 0) return;
    this.pos = position;
    this.lancer(true);
  }

  lire(): void {
    if (this.pisteCourante === undefined) return;
    this.jouer();
  }

  pause(): void {
    this.audio.pause();
  }

  basculer(): void {
    if (this.audio.paused) this.lire();
    else this.pause();
  }

  suivant(): void {
    this.avancer(false);
  }

  precedent(): void {
    if (this.pisteCourante === undefined) return;
    if (this.audio.currentTime > SEUIL_RETOUR_DEBUT) {
      this.aller(0);
    } else if (this.pos > 0) {
      this.pos -= 1;
      this.lancer(!this.audio.paused);
    } else if (this.modeRepetition === 'liste') {
      this.pos = this.ordre.length - 1;
      this.lancer(!this.audio.paused);
    } else {
      this.aller(0);
    }
  }

  /** Se place à `secondes` dans la piste courante. */
  aller(secondes: number): void {
    const duree = this.audio.duration;
    const maximum = Number.isFinite(duree) ? duree : Number.MAX_SAFE_INTEGER;
    this.audio.currentTime = borner(secondes, 0, maximum);
    this.emettre();
  }

  sauter(delta: number): void {
    this.aller(this.audio.currentTime + delta);
  }

  definirVolume(volume: number): void {
    const borne = borner(volume, 0, 1);
    this.audio.volume = borne;
    if (borne > 0) this.audio.muted = false;
  }

  basculerMuet(): void {
    this.audio.muted = !this.audio.muted;
  }

  basculerAleatoire(): void {
    this.modeAleatoire = !this.modeAleatoire;
    if (this.file.length > 0) {
      this.reconstruireOrdre(this.indexCourant());
      this.preparerSuivante();
    }
    this.sauvegarder();
    this.emettre('file');
  }

  /** Passe au mode de répétition suivant : aucune, liste, piste. */
  cyclerRepetition(): void {
    const suite: Record<Repetition, Repetition> = {
      aucune: 'liste',
      liste: 'piste',
      piste: 'aucune',
    };
    this.modeRepetition = suite[this.modeRepetition];
    this.preparerSuivante();
    this.sauvegarder();
    this.emettre();
  }

  /** Ajoute une piste en fin de file. Si la file est vide, elle est chargée sans démarrer. */
  ajouter(piste: Piste): void {
    if (this.file.length === 0) {
      this.charger([piste], 0, false);
      return;
    }
    this.file.push(piste);
    const nouvelIndex = this.file.length - 1;
    if (this.modeAleatoire) {
      const debut = this.pos + 1;
      const position = debut + Math.floor(this.hasard() * (this.ordre.length - debut + 1));
      this.ordre.splice(position, 0, nouvelIndex);
    } else {
      this.ordre.push(nouvelIndex);
    }
    this.preparerSuivante();
    this.emettre('file');
  }

  /** Ajoute plusieurs pistes en fin de file, dans l'ordre. Si la file est vide, elle est chargée sans démarrer. */
  ajouterPlusieurs(pistes: readonly Piste[]): void {
    for (const piste of pistes) this.ajouter(piste);
  }

  /** Retire la piste d'index `index` de la file. */
  retirer(index: number): void {
    if (index < 0 || index >= this.file.length) return;
    const estCourante = index === this.indexCourant();
    const enLecture = !this.audio.paused;
    const positionRetiree = this.ordre.indexOf(index);

    this.file.splice(index, 1);
    this.ordre = this.ordre.filter((i) => i !== index).map((i) => (i > index ? i - 1 : i));
    if (positionRetiree < this.pos) this.pos -= 1;

    if (this.file.length === 0) {
      this.arreter();
    } else if (estCourante) {
      if (this.pos >= this.ordre.length)
        this.pos = this.modeRepetition === 'liste' ? 0 : this.ordre.length - 1;
      this.lancer(enLecture);
      this.emettre('file');
      return;
    } else {
      this.preparerSuivante();
    }
    this.emettre('file');
  }

  /** Déplace la piste d'index `de` à l'index `vers` dans la file (ordre affiché). */
  deplacer(de: number, vers: number): void {
    const n = this.file.length;
    if (de < 0 || de >= n || vers < 0 || vers >= n || de === vers) return;
    const [piste] = this.file.splice(de, 1);
    if (piste === undefined) return;
    this.file.splice(vers, 0, piste);
    const correspondance = (k: number): number => {
      if (k === de) return vers;
      if (de < vers && k > de && k <= vers) return k - 1;
      if (de > vers && k >= vers && k < de) return k + 1;
      return k;
    };
    this.ordre = this.ordre.map(correspondance);
    this.preparerSuivante();
    this.emettre('file');
  }

  /** Charge sans la jouer la dernière piste écoutée, avec son album comme file d'attente. */
  restaurer(retrouver: (id: string) => readonly Piste[] | undefined): void {
    const id = this.lireMemoire().derniere;
    if (id === undefined || this.pisteCourante !== undefined) return;
    const pistes = retrouver(id);
    if (pistes === undefined) return;
    const index = pistes.findIndex((p) => p.id === id);
    if (index >= 0) this.charger(pistes, index, false);
  }

  private indexCourant(): number {
    return this.pos >= 0 ? (this.ordre[this.pos] ?? -1) : -1;
  }

  private hasard(): number {
    return (this.options.aleatoire ?? Math.random)();
  }

  private reconstruireOrdre(courant: number): void {
    const n = this.file.length;
    const autres = Array.from({ length: n }, (_, i) => i).filter((i) => i !== courant);
    if (!this.modeAleatoire) {
      this.ordre = Array.from({ length: n }, (_, i) => i);
      this.pos = courant >= 0 ? courant : n > 0 ? 0 : -1;
      return;
    }
    for (let i = autres.length - 1; i > 0; i -= 1) {
      const j = Math.floor(this.hasard() * (i + 1));
      const a = autres[i];
      const b = autres[j];
      if (a !== undefined && b !== undefined) {
        autres[i] = b;
        autres[j] = a;
      }
    }
    this.ordre = courant >= 0 ? [courant, ...autres] : autres;
    this.pos = n > 0 ? 0 : -1;
  }

  private avancer(automatique: boolean): void {
    if (this.pisteCourante === undefined) return;
    if (this.pos + 1 < this.ordre.length) {
      this.pos += 1;
      this.lancer(true);
    } else if (this.modeRepetition === 'liste') {
      const derniere = this.indexCourant();
      if (this.modeAleatoire) {
        this.reconstruireOrdre(-1);
        // Évite de rejouer immédiatement la dernière piste après le remélange.
        if (this.ordre.length > 1 && this.ordre[0] === derniere) {
          const premier = this.ordre[0];
          const second = this.ordre[1];
          if (premier !== undefined && second !== undefined)
            this.ordre.splice(0, 2, second, premier);
        }
      }
      this.pos = 0;
      this.lancer(true);
      this.emettre('file');
    } else if (automatique) {
      this.emettre();
    }
  }

  private finDePiste(): void {
    if (this.modeRepetition === 'piste') {
      this.audio.currentTime = 0;
      this.jouer();
    } else {
      this.avancer(true);
    }
  }

  private lancer(lire: boolean): void {
    const piste = this.pisteCourante;
    if (piste === undefined) return;
    this.enErreur = false;
    this.erreurReseau = false;
    this.audio.src = this.options.resoudreUrl(piste.fichier);
    if (lire) this.jouer();
    else this.audio.pause();
    this.preparerSuivante();
    this.sauvegarder();
    this.emettre('piste');
  }

  private jouer(): void {
    this.audio.play().catch((erreur: unknown) => {
      const nom = erreur instanceof Error ? erreur.name : '';
      // AbortError : une autre piste a été chargée entre-temps.
      if (nom === 'AbortError') return;
      // NotAllowedError : lecture automatique refusée par le navigateur tant qu'il n'y a pas eu
      // d'action de l'utilisateur. Ce n'est pas une erreur de piste : on le signale.
      if (nom === 'NotAllowedError') {
        this.bloquee = true;
        this.emettre('bloquee');
        return;
      }
      this.enErreur = true;
      this.emettre();
    });
  }

  private arreter(): void {
    this.audio.pause();
    this.audio.removeAttribute('src');
    this.audio.load();
    this.pos = -1;
    this.ordre = [];
    this.enErreur = false;
    this.emettre('piste');
  }

  /**
   * Précharge la piste qui sera jouée ensuite, pour limiter la coupure entre deux pistes. Uniquement
   * pendant la lecture (jamais en pause ni à l'ouverture d'une page) et sans mode économie de données.
   */
  private preparerSuivante(): void {
    if (this.prechargeur === undefined || this.audio.paused) return;
    if (this.options.economieDonnees?.() === true) return;
    let suivant = -1;
    if (this.modeRepetition !== 'piste') {
      if (this.pos + 1 < this.ordre.length) suivant = this.ordre[this.pos + 1] ?? -1;
      else if (this.modeRepetition === 'liste' && !this.modeAleatoire)
        suivant = this.ordre[0] ?? -1;
    }
    const piste = suivant >= 0 ? this.file[suivant] : undefined;
    if (piste === undefined || suivant === this.indexCourant()) return;
    if (piste.fichier === this.cheminPrecharge) return;
    this.cheminPrecharge = piste.fichier;
    this.prechargeur.preload = 'auto';
    this.prechargeur.src = this.options.resoudreUrl(piste.fichier);
  }

  private lireMemoire(): Memoire {
    const defaut: Memoire = {
      volume: 1,
      muet: false,
      aleatoire: this.options.aleatoireParDefaut === true,
      repetition: 'aucune',
    };
    try {
      const brut = this.options.stockage?.getItem(CLE_STOCKAGE);
      if (brut === null || brut === undefined) return defaut;
      const lu = JSON.parse(brut) as Partial<Memoire>;
      return {
        volume: typeof lu.volume === 'number' ? borner(lu.volume, 0, 1) : defaut.volume,
        muet: lu.muet === true,
        aleatoire: lu.aleatoire === true,
        repetition:
          lu.repetition === 'piste' || lu.repetition === 'liste' ? lu.repetition : 'aucune',
        ...(typeof lu.derniere === 'string' && { derniere: lu.derniere }),
      };
    } catch {
      return defaut;
    }
  }

  private sauvegarder(): void {
    try {
      const derniere = this.pisteCourante?.id ?? this.lireMemoire().derniere;
      const memoire: Memoire = {
        volume: this.audio.volume,
        muet: this.audio.muted,
        aleatoire: this.modeAleatoire,
        repetition: this.modeRepetition,
        ...(derniere !== undefined && { derniere }),
      };
      this.options.stockage?.setItem(CLE_STOCKAGE, JSON.stringify(memoire));
    } catch {
      // Stockage indisponible : les réglages ne sont pas mémorisés.
    }
  }

  private emettre(supplementaire?: 'piste' | 'file' | 'bloquee'): void {
    if (supplementaire !== undefined) this.dispatchEvent(new Event(supplementaire));
    this.dispatchEvent(new Event('etat'));
  }
}
