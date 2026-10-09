// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync } from 'node:fs';
import { mkdtemp, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import sharp from 'sharp';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
  TAILLE_GRANDE,
  TAILLE_MINIATURE,
  TAILLE_PARTAGE,
  cheminImagePartage,
  pochetteReduite,
} from '../src/catalogue/pochettes';
import { ConvertisseurPochettes } from '../scripts/catalogue/pochettes';

let dossier: string;

beforeEach(async () => {
  dossier = await mkdtemp(join(tmpdir(), 'ap3x-pochettes-'));
});

afterEach(async () => {
  await rm(dossier, { recursive: true, force: true });
});

/** Métadonnées d'une image du dossier, lue en mémoire (Windows verrouille les fichiers ouverts par chemin). */
async function metadonnees(chemin: string) {
  return sharp(await readFile(join(dossier, chemin.replace('pochettes/', '')))).metadata();
}

/** Image PNG unie de la taille et de la couleur données. */
function png(largeur: number, hauteur: number, couleur = '#cc3300'): Promise<Buffer> {
  return sharp({
    create: { width: largeur, height: hauteur, channels: 3, background: couleur },
  })
    .png()
    .toBuffer();
}

describe('chemins de pochettes', () => {
  it("déduit l'image de partage de la grande pochette", () => {
    expect(cheminImagePartage('pochettes/abc123.webp')).toBe('pochettes/abc123-og.jpg');
  });

  it('préfère la miniature pour les petits affichages', () => {
    expect(pochetteReduite({ pochette: 'g.webp', miniature: 'm.webp' } as never)).toBe('m.webp');
    expect(pochetteReduite({ pochette: 'g.webp' } as never)).toBe('g.webp');
    expect(pochetteReduite({} as never)).toBeUndefined();
  });
});

describe('conversion des pochettes', () => {
  it('produit une grande pochette WebP, une miniature WebP et un JPEG de partage', async () => {
    const convertisseur = new ConvertisseurPochettes(dossier);
    const resultat = await convertisseur.depuisDonnees(await png(2000, 2000));
    expect(resultat.pochette).toMatch(/^pochettes\/[0-9a-f]{16}\.webp$/);
    expect(resultat.miniature).toMatch(/^pochettes\/[0-9a-f]{16}-m\.webp$/);

    const grande = await metadonnees(resultat.pochette);
    const petite = await metadonnees(resultat.miniature);
    const partage = await metadonnees(cheminImagePartage(resultat.pochette));
    expect([grande.format, petite.format, partage.format]).toEqual(['webp', 'webp', 'jpeg']);
    expect(grande.width).toBe(TAILLE_GRANDE);
    expect(petite.width).toBe(TAILLE_MINIATURE);
    expect(partage.width).toBe(TAILLE_PARTAGE);
  });

  it("n'agrandit jamais une petite image et garde ses proportions", async () => {
    const convertisseur = new ConvertisseurPochettes(dossier);
    const petite = await convertisseur.depuisDonnees(await png(200, 100));
    const meta = await metadonnees(petite.pochette);
    expect([meta.width, meta.height]).toEqual([200, 100]);
    const grande = await convertisseur.depuisDonnees(await png(3000, 1500));
    const metaGrande = await metadonnees(grande.pochette);
    expect([metaGrande.width, metaGrande.height]).toEqual([TAILLE_GRANDE, TAILLE_GRANDE / 2]);
  });

  it("réduit fortement le poids d'une grande image", async () => {
    const convertisseur = new ConvertisseurPochettes(dossier);
    const source = await sharp({
      create: { width: 3000, height: 3000, channels: 3, background: '#336699' },
    })
      .png()
      .toBuffer();
    const resultat = await convertisseur.depuisDonnees(source);
    const { size } = await stat(join(dossier, resultat.miniature.replace('pochettes/', '')));
    expect(size).toBeLessThan(source.length / 10);
  });

  it('donne le même nom à un contenu identique et des noms différents à des contenus différents', async () => {
    const convertisseur = new ConvertisseurPochettes(dossier);
    const a = await convertisseur.depuisDonnees(await png(100, 100, '#ff0000'));
    const b = await convertisseur.depuisDonnees(await png(100, 100, '#ff0000'));
    const c = await convertisseur.depuisDonnees(await png(100, 100, '#00ff00'));
    expect(b).toEqual(a);
    expect(c.pochette).not.toBe(a.pochette);
    expect(await readdir(dossier)).toHaveLength(6);
  });

  it("ne refait pas une conversion déjà faite lors d'un nouveau lancement", async () => {
    const donnees = await png(400, 400);
    const premier = await new ConvertisseurPochettes(dossier).depuisDonnees(donnees);
    const fichier = join(dossier, premier.miniature.replace('pochettes/', ''));
    await writeFile(fichier, 'marqueur'); // détecte une réécriture
    await new ConvertisseurPochettes(dossier).depuisDonnees(donnees);
    expect(await readFile(fichier, 'utf8')).toBe('marqueur');
  });

  it("refuse un fichier qui n'est pas une image", async () => {
    const convertisseur = new ConvertisseurPochettes(dossier);
    await expect(convertisseur.depuisDonnees(Buffer.from('pas une image'))).rejects.toThrow();
  });

  it('supprime les déclinaisons devenues inutiles, et elles seules', async () => {
    const ancien = new ConvertisseurPochettes(dossier);
    await ancien.depuisDonnees(await png(100, 100, '#ff0000'));
    await writeFile(join(dossier, 'orphelin.png'), 'x');

    const courant = new ConvertisseurPochettes(dossier);
    const garde = await courant.depuisDonnees(await png(100, 100, '#0000ff'));
    const supprimes = await courant.nettoyer();
    // 3 fichiers de l'ancienne image + le fichier orphelin.
    expect(supprimes).toBe(4);
    const restants = await readdir(dossier);
    expect(restants).toHaveLength(3);
    expect(existsSync(join(dossier, garde.pochette.replace('pochettes/', '')))).toBe(true);
  });

  it("ne plante pas si le dossier de sortie n'existe pas encore", async () => {
    const absent = join(dossier, 'inexistant');
    expect(await new ConvertisseurPochettes(absent).nettoyer()).toBe(0);
  });
});
