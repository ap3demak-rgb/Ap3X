// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import type { LotCommit } from './album';
import type { ClientGitHub, Progression } from './github';

export interface AvancementLots {
  /** Numéro du commit en cours (à partir de 1) et nombre total de commits. */
  lot: number;
  totalLots: number;
  /** Octets de MP3 déjà transmis, tous commits confondus, et total. */
  octets: number;
  totalOctets: number;
}

/** Envoi en plusieurs commits dont on peut reprendre le cours après un échec. */
export class EnvoiParLots {
  private suivant = 0;
  private readonly octetsParLot: number[];
  private readonly totalOctets: number;

  constructor(
    private readonly client: Pick<ClientGitHub, 'commit'>,
    private readonly lots: readonly LotCommit[],
  ) {
    this.octetsParLot = lots.map((lot) =>
      lot.changements.reduce((somme, c) => somme + ('contenu' in c ? c.contenu.length : 0), 0),
    );
    this.totalOctets = this.octetsParLot.reduce((somme, o) => somme + o, 0);
  }

  /** Nombre de commits déjà publiés. */
  get termines(): number {
    return this.suivant;
  }

  get total(): number {
    return this.lots.length;
  }

  get fini(): boolean {
    return this.suivant >= this.lots.length;
  }

  /**
   * Publie les commits restants, dans l'ordre. En cas d'échec l'erreur est propagée et l'état est conservé :
   * un nouvel appel reprend au commit interrompu, sans renvoyer ce qui est déjà publié.
   */
  async envoyer(surProgression?: (avancement: AvancementLots) => void): Promise<void> {
    while (this.suivant < this.lots.length) {
      const lot = this.lots[this.suivant];
      if (lot === undefined) break;
      const deja = this.octetsParLot.slice(0, this.suivant).reduce((somme, o) => somme + o, 0);
      const signaler = (octetsLot: number): void =>
        surProgression?.({
          lot: this.suivant + 1,
          totalLots: this.lots.length,
          octets: deja + octetsLot,
          totalOctets: this.totalOctets,
        });
      signaler(0);
      await this.client.commit(lot.message, lot.changements, (p: Progression) =>
        signaler(p.octets),
      );
      this.suivant += 1;
    }
    surProgression?.({
      lot: this.lots.length,
      totalLots: this.lots.length,
      octets: this.totalOctets,
      totalOctets: this.totalOctets,
    });
  }
}
