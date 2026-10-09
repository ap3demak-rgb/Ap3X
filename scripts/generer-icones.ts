// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import pngToIco from 'png-to-ico';
import sharp from 'sharp';

const dossierIcones = join('public', 'icones');
const source = await readFile(join(dossierIcones, 'favicon.svg'));

const tailles: Record<string, number> = {
  'favicon-32.png': 32,
  'apple-touch-icon.png': 180,
  'icone-192.png': 192,
  'icone-512.png': 512,
};

await mkdir(dossierIcones, { recursive: true });

for (const [nom, taille] of Object.entries(tailles)) {
  await sharp(source, { density: 384 })
    .resize(taille, taille)
    .png()
    .toFile(join(dossierIcones, nom));
}

// Icône « maskable » : fond plein jusqu'aux bords, logo dans la zone sûre (70 % central), pour que
// les systèmes qui la découpent (cercle, carré arrondi) ne rognent pas le logo.
const TAILLE_MASKABLE = 512;
const logoMaskable = await sharp(source, { density: 384 })
  .resize(Math.round(TAILLE_MASKABLE * 0.7), Math.round(TAILLE_MASKABLE * 0.7))
  .png()
  .toBuffer();
await sharp({
  create: { width: TAILLE_MASKABLE, height: TAILLE_MASKABLE, channels: 4, background: '#0b0b10' },
})
  .composite([{ input: logoMaskable, gravity: 'center' }])
  .png()
  .toFile(join(dossierIcones, 'icone-maskable-512.png'));

const png16 = await sharp(source, { density: 384 }).resize(16, 16).png().toBuffer();
const png32 = await sharp(source, { density: 384 }).resize(32, 32).png().toBuffer();
const png48 = await sharp(source, { density: 384 }).resize(48, 48).png().toBuffer();
await writeFile(join('public', 'favicon.ico'), await pngToIco([png16, png32, png48]));

console.log('Icônes générées dans public/icones et public/favicon.ico');
