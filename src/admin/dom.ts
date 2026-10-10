// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Crée un élément avec une classe et un texte facultatifs. */
export function element<K extends keyof HTMLElementTagNameMap>(
  nom: K,
  classe?: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const noeud = document.createElement(nom);
  if (classe !== undefined) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

/** Champ de formulaire étiqueté : l'étiquette entoure le contrôle, ce qui les associe sans identifiant. */
export function champ<T extends HTMLElement>(libelle: string, controle: T): HTMLLabelElement {
  const etiquette = element('label', 'champ');
  etiquette.append(element('span', undefined, libelle), controle);
  return etiquette;
}

/** Taille lisible d'un fichier dans la langue courante (« 4,2 Mo »). */
export function formaterTaille(octets: number, langue: string): string {
  const unites = ['B', 'KB', 'MB', 'GB'];
  let valeur = octets;
  let i = 0;
  while (valeur >= 1024 && i < unites.length - 1) {
    valeur /= 1024;
    i += 1;
  }
  return `${new Intl.NumberFormat(langue, { maximumFractionDigits: i === 0 ? 0 : 1 }).format(valeur)} ${unites[i]}`;
}
