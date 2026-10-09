// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { Piste } from '../src/catalogue/schemas';
import { Lecteur, type ElementAudio } from '../src/lecteur/lecteur';

class FauxAudio extends EventTarget {
  src = '';
  currentTime = 0;
  duration = Number.NaN;
  volume = 1;
  muted = false;
  paused = true;
  preload = '';
  play(): Promise<void> {
    this.paused = false;
    this.dispatchEvent(new Event('play'));
    return Promise.resolve();
  }
  pause(): void {
    if (this.paused) return;
    this.paused = true;
    this.dispatchEvent(new Event('pause'));
  }
  removeAttribute(nom: string): void {
    if (nom === 'src') this.src = '';
  }
  load(): void {
    // Sans effet dans les tests.
  }
  terminer(): void {
    this.dispatchEvent(new Event('ended'));
  }
}

function piste(id: string): Piste {
  return {
    id,
    titre: id.toUpperCase(),
    artiste: 'AP3X Records',
    description: '',
    hashtags: [],
    categorie: 'cat',
    duree: 60,
    fichier: `musique/cat/${id}.mp3`,
    telechargement: false,
    licence: 'CC BY-NC-ND 4.0',
    copyright: '© 2026 AP3X Records',
  };
}

class StockageMemoire {
  donnees = new Map<string, string>();
  getItem(cle: string): string | null {
    return this.donnees.get(cle) ?? null;
  }
  setItem(cle: string, valeur: string): void {
    this.donnees.set(cle, valeur);
  }
}

let audio: FauxAudio;
let prechargeur: FauxAudio;
let stockage: StockageMemoire;
let lecteur: Lecteur;
const PISTES = ['a', 'b', 'c', 'd'].map(piste);

function creer(aleatoire: () => number = () => 0): Lecteur {
  return new Lecteur({
    audio: audio as unknown as ElementAudio,
    prechargeur: prechargeur as unknown as ElementAudio,
    stockage,
    resoudreUrl: (chemin) => `/${chemin}`,
    aleatoire,
  });
}

const ids = (l: Lecteur): string[] => l.etat().file.map((p) => p.id);
const courante = (l: Lecteur): string | undefined => l.etat().piste?.id;

beforeEach(() => {
  audio = new FauxAudio();
  prechargeur = new FauxAudio();
  stockage = new StockageMemoire();
  lecteur = creer();
});

describe('lecture et navigation', () => {
  it('charge une file et joue la piste demandée', () => {
    lecteur.charger(PISTES, 1);
    expect(courante(lecteur)).toBe('b');
    expect(audio.src).toBe('/musique/cat/b.mp3');
    expect(audio.paused).toBe(false);
  });

  it('peut charger sans démarrer', () => {
    lecteur.charger(PISTES, 0, false);
    expect(audio.paused).toBe(true);
    expect(courante(lecteur)).toBe('a');
  });

  it('passe à la piste suivante et revient en arrière', () => {
    lecteur.charger(PISTES, 0);
    lecteur.suivant();
    expect(courante(lecteur)).toBe('b');
    lecteur.precedent();
    expect(courante(lecteur)).toBe('a');
  });

  it("« précédent » revient d'abord au début si la piste est avancée", () => {
    lecteur.charger(PISTES, 2);
    audio.currentTime = 30;
    lecteur.precedent();
    expect(courante(lecteur)).toBe('c');
    expect(audio.currentTime).toBe(0);
  });

  it("enchaîne automatiquement à la fin d'une piste", () => {
    lecteur.charger(PISTES, 0);
    audio.terminer();
    expect(courante(lecteur)).toBe('b');
    expect(audio.paused).toBe(false);
  });

  it("s'arrête à la fin de la file sans répétition", () => {
    lecteur.charger(PISTES, 3);
    audio.terminer();
    expect(courante(lecteur)).toBe('d');
  });

  it('reprend au début avec la répétition de liste', () => {
    lecteur.charger(PISTES, 3);
    lecteur.cyclerRepetition();
    expect(lecteur.etat().repetition).toBe('liste');
    audio.terminer();
    expect(courante(lecteur)).toBe('a');
    expect(audio.paused).toBe(false);
  });

  it('rejoue la même piste avec la répétition de piste', () => {
    lecteur.charger(PISTES, 1);
    lecteur.cyclerRepetition();
    lecteur.cyclerRepetition();
    expect(lecteur.etat().repetition).toBe('piste');
    audio.currentTime = 42;
    audio.terminer();
    expect(courante(lecteur)).toBe('b');
    expect(audio.currentTime).toBe(0);
  });

  it('bascule lecture et pause', () => {
    lecteur.charger(PISTES, 0);
    lecteur.basculer();
    expect(audio.paused).toBe(true);
    lecteur.basculer();
    expect(audio.paused).toBe(false);
  });

  it('borne la position', () => {
    lecteur.charger(PISTES, 0);
    lecteur.aller(-10);
    expect(audio.currentTime).toBe(0);
    audio.duration = 100;
    lecteur.aller(500);
    expect(audio.currentTime).toBe(100);
  });
});

describe('volume', () => {
  it('borne le volume et lève le mode muet', () => {
    lecteur.basculerMuet();
    expect(audio.muted).toBe(true);
    lecteur.definirVolume(2);
    expect(audio.volume).toBe(1);
    expect(audio.muted).toBe(false);
    lecteur.definirVolume(-1);
    expect(audio.volume).toBe(0);
  });

  it('mémorise et restaure les réglages', () => {
    lecteur.charger(PISTES, 2, false);
    lecteur.definirVolume(0.4);
    audio.dispatchEvent(new Event('volumechange'));
    lecteur.cyclerRepetition();
    const audio2 = new FauxAudio();
    const lecteur2 = new Lecteur({
      audio: audio2 as unknown as ElementAudio,
      stockage,
      resoudreUrl: (c) => c,
    });
    expect(audio2.volume).toBe(0.4);
    expect(lecteur2.etat().repetition).toBe('liste');
    lecteur2.restaurer(() => PISTES);
    expect(lecteur2.etat().piste?.id).toBe('c');
    expect(audio2.paused).toBe(true);
  });

  it('ignore un stockage corrompu', () => {
    stockage.setItem('ap3x.lecteur', '{pas du json');
    expect(() => creer()).not.toThrow();
  });
});

describe("file d'attente", () => {
  it('ajoute une piste en fin de file', () => {
    lecteur.charger(PISTES.slice(0, 2), 0);
    lecteur.ajouter(piste('e'));
    expect(ids(lecteur)).toEqual(['a', 'b', 'e']);
    lecteur.suivant();
    lecteur.suivant();
    expect(courante(lecteur)).toBe('e');
  });

  it('charge la piste ajoutée si la file est vide, sans la jouer', () => {
    lecteur.ajouter(piste('x'));
    expect(courante(lecteur)).toBe('x');
    expect(audio.paused).toBe(true);
  });

  it('retire une piste avant la courante sans changer la lecture', () => {
    lecteur.charger(PISTES, 2);
    lecteur.retirer(0);
    expect(ids(lecteur)).toEqual(['b', 'c', 'd']);
    expect(courante(lecteur)).toBe('c');
    lecteur.suivant();
    expect(courante(lecteur)).toBe('d');
  });

  it('retirer la piste courante passe à la suivante', () => {
    lecteur.charger(PISTES, 1);
    lecteur.retirer(1);
    expect(ids(lecteur)).toEqual(['a', 'c', 'd']);
    expect(courante(lecteur)).toBe('c');
    expect(audio.paused).toBe(false);
  });

  it('vider la file arrête la lecture', () => {
    lecteur.charger([piste('a')], 0);
    lecteur.retirer(0);
    expect(courante(lecteur)).toBeUndefined();
    expect(audio.paused).toBe(true);
    expect(audio.src).toBe('');
  });

  it('déplace une piste en conservant la piste courante', () => {
    lecteur.charger(PISTES, 1);
    lecteur.deplacer(3, 0);
    expect(ids(lecteur)).toEqual(['d', 'a', 'b', 'c']);
    expect(courante(lecteur)).toBe('b');
    lecteur.suivant();
    expect(courante(lecteur)).toBe('c');
    lecteur.deplacer(0, 3);
    expect(ids(lecteur)).toEqual(['a', 'b', 'c', 'd']);
    expect(courante(lecteur)).toBe('c');
  });

  it('précharge la piste suivante', () => {
    lecteur.charger(PISTES, 0);
    expect(prechargeur.src).toBe('/musique/cat/b.mp3');
    lecteur.suivant();
    expect(prechargeur.src).toBe('/musique/cat/c.mp3');
  });

  it("joue l'index demandé", () => {
    lecteur.charger(PISTES, 0);
    lecteur.jouerIndex(3);
    expect(courante(lecteur)).toBe('d');
  });
});

describe('lecture aléatoire', () => {
  it('joue toutes les pistes une seule fois en commençant par la courante', () => {
    let graine = 0.3;
    const l = creer(() => {
      graine = (graine * 9301 + 0.49297) % 1;
      return graine;
    });
    l.basculerAleatoire();
    l.charger(PISTES, 2);
    const jouees = [courante(l)];
    for (let i = 0; i < PISTES.length - 1; i += 1) {
      l.suivant();
      jouees.push(courante(l));
    }
    expect(jouees[0]).toBe('c');
    expect([...jouees].sort()).toEqual(['a', 'b', 'c', 'd']);
    expect(ids(l)).toEqual(['a', 'b', 'c', 'd']);
  });

  it('conserve la piste courante quand on active le mode', () => {
    lecteur.charger(PISTES, 2);
    lecteur.basculerAleatoire();
    expect(courante(lecteur)).toBe('c');
    lecteur.basculerAleatoire();
    expect(courante(lecteur)).toBe('c');
    lecteur.suivant();
    expect(courante(lecteur)).toBe('d');
  });

  it('insère une piste ajoutée après la piste courante', () => {
    lecteur.basculerAleatoire();
    lecteur.charger(PISTES, 0);
    lecteur.ajouter(piste('e'));
    const vues = new Set<string | undefined>([courante(lecteur)]);
    for (let i = 0; i < PISTES.length; i += 1) {
      lecteur.suivant();
      vues.add(courante(lecteur));
    }
    expect(vues.has('e')).toBe(true);
  });
});

describe('ajout de plusieurs pistes', () => {
  it("ajoute dans l'ordre, et charge sans démarrer si la file est vide", () => {
    lecteur.ajouterPlusieurs([piste('x'), piste('y'), piste('z')]);
    expect(ids(lecteur)).toEqual(['x', 'y', 'z']);
    expect(courante(lecteur)).toBe('x');
    expect(audio.paused).toBe(true);
    lecteur.ajouterPlusieurs([piste('w')]);
    expect(ids(lecteur)).toEqual(['x', 'y', 'z', 'w']);
  });
});

describe('lecture automatique refusée par le navigateur', () => {
  it("signale le blocage sans le traiter comme une erreur de piste, puis l'efface à la lecture", async () => {
    audio.play = (): Promise<void> => {
      const erreur = new Error('bloquée');
      erreur.name = 'NotAllowedError';
      return Promise.reject(erreur);
    };
    const surBlocage = vi.fn();
    lecteur.addEventListener('bloquee', surBlocage);
    lecteur.charger(PISTES, 1);
    await Promise.resolve();
    await Promise.resolve();
    expect(surBlocage).toHaveBeenCalledTimes(1);
    expect(lecteur.etat().lectureBloquee).toBe(true);
    expect(lecteur.etat().erreur).toBe(false);
    expect(courante(lecteur)).toBe('b');

    audio.dispatchEvent(new Event('play'));
    expect(lecteur.etat().lectureBloquee).toBe(false);
  });

  it('range les autres refus parmi les erreurs de piste', async () => {
    audio.play = (): Promise<void> => {
      const erreur = new Error('format');
      erreur.name = 'NotSupportedError';
      return Promise.reject(erreur);
    };
    lecteur.charger(PISTES, 0);
    await Promise.resolve();
    await Promise.resolve();
    expect(lecteur.etat().erreur).toBe(true);
    expect(lecteur.etat().lectureBloquee).toBe(false);
  });
});

describe('préchargement de la piste suivante', () => {
  it('ne télécharge rien tant que rien ne joue', () => {
    lecteur.charger(PISTES, 0, false);
    expect(prechargeur.src).toBe('');
    expect(prechargeur.preload).toBe('none');
    lecteur.ajouter(piste('e'));
    expect(prechargeur.src).toBe('');
  });

  it('précharge dès que la lecture démarre, puis suit les changements de piste', () => {
    lecteur.charger(PISTES, 0, false);
    lecteur.lire();
    audio.dispatchEvent(new Event('play'));
    expect(prechargeur.src).toBe('/musique/cat/b.mp3');
    expect(prechargeur.preload).toBe('auto');
  });

  it('ne précharge pas en mode économie de données', () => {
    const economie = new Lecteur({
      audio: audio as unknown as ElementAudio,
      prechargeur: prechargeur as unknown as ElementAudio,
      stockage,
      resoudreUrl: (chemin) => `/${chemin}`,
      economieDonnees: () => true,
    });
    economie.charger(PISTES, 0);
    expect(prechargeur.src).toBe('');
    expect(prechargeur.preload).toBe('none');
  });

  it('ne précharge pas la piste de la répétition de piste', () => {
    lecteur.charger(PISTES, 0);
    lecteur.cyclerRepetition();
    lecteur.cyclerRepetition();
    const avant = prechargeur.src;
    lecteur.suivant();
    expect(prechargeur.src).toBe(avant);
  });
});
