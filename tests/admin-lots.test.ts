// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { describe, expect, it } from 'vitest';
import type { LotCommit } from '../src/admin/album';
import { ErreurGitHub, type Changement, type Progression } from '../src/admin/github';
import { EnvoiParLots, type AvancementLots } from '../src/admin/lots';

const lot = (message: string, octets: number): LotCommit => ({
  message,
  changements: [{ chemin: `${message}.mp3`, contenu: new Uint8Array(octets) }],
});

/** Faux client : échoue aux appels dont le numéro figure dans `echecs`. */
function faux(echecs: number[] = []) {
  const appels: string[] = [];
  const reussis: string[] = [];
  return {
    appels,
    reussis,
    client: {
      commit: (
        message: string,
        changements: readonly Changement[],
        progression?: (p: Progression) => void,
      ): Promise<string> => {
        appels.push(message);
        if (echecs.includes(appels.length)) {
          return Promise.reject(new ErreurGitHub('Réseau injoignable', 'reseau'));
        }
        const octets = changements.reduce(
          (somme, c) => somme + ('contenu' in c ? c.contenu.length : 0),
          0,
        );
        progression?.({
          fichiers: changements.length,
          totalFichiers: changements.length,
          octets,
          totalOctets: octets,
        });
        reussis.push(message);
        return Promise.resolve('sha');
      },
    },
  };
}

describe('envoi par lots', () => {
  it('publie les commits dans l’ordre et rapporte un avancement pondéré par les octets', async () => {
    const { client, reussis } = faux();
    const envoi = new EnvoiParLots(client, [lot('a', 10), lot('b', 30), lot('c', 0)]);
    const vus: AvancementLots[] = [];
    await envoi.envoyer((a) => vus.push(a));
    expect(reussis).toEqual(['a', 'b', 'c']);
    expect(envoi.fini).toBe(true);
    expect(envoi.termines).toBe(3);
    const dernier = vus.at(-1);
    expect(dernier).toEqual({ lot: 3, totalLots: 3, octets: 40, totalOctets: 40 });
    // L’avancement ne recule jamais.
    for (let i = 1; i < vus.length; i += 1) {
      expect(vus[i]?.octets ?? 0).toBeGreaterThanOrEqual(vus[i - 1]?.octets ?? 0);
    }
  });

  it('après un échec, reprend au commit interrompu sans renvoyer les précédents', async () => {
    const { client, appels, reussis } = faux([3]);
    const envoi = new EnvoiParLots(client, [lot('a', 5), lot('b', 5), lot('c', 5), lot('d', 5)]);
    await expect(envoi.envoyer()).rejects.toMatchObject({ code: 'reseau' });
    expect(envoi.termines).toBe(2);
    expect(envoi.fini).toBe(false);

    await envoi.envoyer();
    expect(envoi.fini).toBe(true);
    expect(reussis).toEqual(['a', 'b', 'c', 'd']);
    // Le commit « c » a été tenté deux fois, les autres une seule.
    expect(appels).toEqual(['a', 'b', 'c', 'c', 'd']);
  });

  it('ne fait rien quand tout est déjà publié', async () => {
    const { client, appels } = faux();
    const envoi = new EnvoiParLots(client, [lot('a', 1)]);
    await envoi.envoyer();
    await envoi.envoyer();
    expect(appels).toEqual(['a']);
  });
});
