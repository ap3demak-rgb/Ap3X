// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { readFileSync } from 'node:fs';
import { ratioContraste, SEUILS } from './contrastes.ts';
import { fichiersDuDepot, terminer } from './utilitaires.ts';

/**
 * Vérifie la palette de src/styles/theme.css contre WCAG 2.2 AAA et le thème sombre unique.
 * Les jetons sont lus dans le bloc :root ; tout jeton couleur utilisé par une paire doit exister.
 */
const css = readFileSync('src/styles/theme.css', 'utf8');
const jetons = new Map<string, string>();
for (const [, nom, valeur] of css.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
  if (nom !== undefined && valeur !== undefined) jetons.set(nom, valeur);
}

interface Paire {
  texte: string;
  fond: string;
  seuil: number;
  usage: string;
}

const SURFACES = ['fond', 'surface'];
const paires: Paire[] = [];
for (const fond of SURFACES) {
  paires.push(
    { texte: 'texte', fond, seuil: SEUILS.texte, usage: 'texte normal' },
    { texte: 'texte-secondaire', fond, seuil: SEUILS.texte, usage: 'texte secondaire' },
    { texte: 'accent', fond, seuil: SEUILS.texte, usage: 'liens et hashtags' },
    { texte: 'bordure', fond, seuil: SEUILS.composant, usage: 'bordures et icônes' },
    { texte: 'focus', fond, seuil: SEUILS.composant, usage: 'indicateur de focus' },
    { texte: 'onde', fond, seuil: SEUILS.composant, usage: 'waveform (partie non lue)' },
    { texte: 'onde-lue', fond, seuil: SEUILS.composant, usage: 'waveform (partie lue)' },
    { texte: 'accent', fond, seuil: SEUILS.composant, usage: 'curseurs et icônes actives' },
  );
}
// Pas de paire « focus sur accent » : le focus a un décalage (outline-offset), il se détache du fond de page.
paires.push(
  { texte: 'fond', fond: 'accent', seuil: SEUILS.texte, usage: "texte sur bouton d'accent" },
  {
    texte: 'texte',
    fond: 'accent-sombre',
    seuil: SEUILS.texte,
    usage: "texte sur fond d'accent sombre",
  },
  { texte: 'onde-lue', fond: 'onde', seuil: SEUILS.composant, usage: 'distinction lu / non lu' },
);

const erreurs: string[] = [];
let controles = 0;
for (const { texte, fond, seuil, usage } of paires) {
  const couleurTexte = jetons.get(texte);
  const couleurFond = jetons.get(fond);
  if (couleurTexte === undefined || couleurFond === undefined) {
    erreurs.push(`Jeton manquant dans theme.css : --${couleurTexte === undefined ? texte : fond}`);
    continue;
  }
  controles += 1;
  const ratio = ratioContraste(couleurTexte, couleurFond);
  if (ratio < seuil) {
    erreurs.push(
      `Contraste insuffisant (${usage}) : --${texte} ${couleurTexte} sur --${fond} ${couleurFond} = ${ratio.toFixed(2)}:1 (minimum ${seuil}:1)`,
    );
  }
}

// Thème sombre unique : ni thème clair, ni préférence de couleur, ni bouton de bascule.
for (const fichier of fichiersDuDepot()) {
  if (!/\.(css|ts|html)$/.test(fichier) || fichier.startsWith('scripts/')) continue;
  const contenu = readFileSync(fichier, 'utf8');
  if (
    /prefers-color-scheme\s*:\s*light/.test(contenu) ||
    /color-scheme\s*:\s*[^;]*light/.test(contenu)
  ) {
    erreurs.push(`Thème clair interdit dans ${fichier}`);
  }
}
if (!/color-scheme:\s*dark\s*;/.test(css))
  erreurs.push('theme.css doit déclarer « color-scheme: dark ».');
if (
  !/<meta\s+name="color-scheme"\s+content="dark"\s*\/?>/.test(readFileSync('index.html', 'utf8'))
) {
  erreurs.push('index.html doit contenir <meta name="color-scheme" content="dark">.');
}

terminer(erreurs, `Contrastes : ${controles} paires conformes WCAG 2.2 AAA, thème sombre unique.`);
