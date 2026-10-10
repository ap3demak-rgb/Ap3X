// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { CATEGORIE_FAVORIS, CATEGORIE_TOUT } from '../catalogue/navigation';
import { FicheCategorieSchema } from '../catalogue/schemas';
import { slugifier, titreDepuisNomFichier } from '../catalogue/texte';
import { ratioContraste, SEUILS } from '../contraste';
import {
  DOSSIER_MUSIQUE,
  identifiantAlbumDepot,
  identifiantPisteDepot,
  type AnalyseDepot,
  type CategorieDepot,
  type FichierDepot,
} from './depot';
import type { FicheBrute } from './edition';
import { memeContenu } from './album';
import type { Changement } from './github';

/**
 * Couleurs de fond du site entre lesquelles se trouve le contenu : la couleur de page et le maximum du fond
 * animé (`--fond` et `--fond-3d-max` de `src/styles/theme.css`, vérifiés par un test).
 */
export const FONDS_SITE = ['#0b0b10', '#2b2150'] as const;

const NOMS_POCHETTE = ['cover', 'pochette'];

/** Données saisies pour une catégorie. */
export interface FormulaireCategorie {
  nom: string;
  description: string;
  /** `#RRGGBB`, ou vide pour la couleur par défaut. */
  couleur: string;
}

export type ChampCategorie =
  'nom' | 'reserve' | 'doublon' | 'couleur' | 'contraste' | 'destination' | 'conflit';

export interface ErreurCategorie {
  champ: ChampCategorie;
  /** Identifiant ou nom en cause. */
  id?: string;
  /** Plus petit ratio de contraste, pour `contraste`. */
  ratio?: number;
  /** Chemins qui existent déjà à destination, pour `conflit`. */
  chemins?: string[];
}

export type PlanCategorie =
  | { ok: true; changements: Changement[]; message: string; dossier: string }
  | { ok: false; erreurs: ErreurCategorie[] };

const texte = (valeur: unknown): string => (typeof valeur === 'string' ? valeur : '');
const nomDe = (chemin: string): string => chemin.slice(chemin.lastIndexOf('/') + 1);
const sansExtension = (nom: string): string => {
  const point = nom.lastIndexOf('.');
  return point < 0 ? nom : nom.slice(0, point);
};

/** Plus petit ratio de contraste de `couleur` avec les fonds du site ; `undefined` si la couleur est invalide. */
export function ratioCouleur(couleur: string): number | undefined {
  if (!/^#[0-9a-fA-F]{6}$/.test(couleur)) return undefined;
  return Math.min(...FONDS_SITE.map((fond) => ratioContraste(couleur, fond)));
}

/** Erreurs de couleur : format invalide, ou contraste insuffisant (3:1 pour un composant d'interface). */
function erreursCouleur(couleur: string): ErreurCategorie[] {
  const propre = couleur.trim();
  if (propre === '') return [];
  const ratio = ratioCouleur(propre);
  if (ratio === undefined) return [{ champ: 'couleur' }];
  if (ratio < SEUILS.composant) return [{ champ: 'contraste', ratio }];
  return [];
}

/** Valeurs du formulaire d'une catégorie existante. */
export function formulaireDepuisCategorie(
  cat: CategorieDepot,
  fiche: FicheBrute | undefined,
): FormulaireCategorie {
  return {
    nom: texte(fiche?.['nom']) || titreDepuisNomFichier(cat.dossier),
    description: texte(fiche?.['description']),
    couleur: texte(fiche?.['couleur']),
  };
}

/** Ce que la liste affiche d'une catégorie. */
export interface LigneCategorie {
  dossier: string;
  nom: string;
  description: string;
  couleur: string;
  /** Position demandée par la fiche (`ordre`), si elle en a une. */
  ordre?: number;
  pistes: number;
  albums: number;
  categorie: CategorieDepot;
}

export function ligneCategorie(cat: CategorieDepot, fiche: FicheBrute | undefined): LigneCategorie {
  const f = formulaireDepuisCategorie(cat, fiche);
  const ordre = fiche?.['ordre'];
  return {
    dossier: cat.dossier,
    nom: f.nom,
    description: f.description,
    couleur: f.couleur,
    ...(typeof ordre === 'number' && { ordre }),
    pistes: cat.pistes.length,
    albums: cat.albums.length,
    categorie: cat,
  };
}

/**
 * Lignes dans l'ordre où le site affiche les catégories : celles qui ont un `ordre` d'abord (dans cet
 * ordre), les autres ensuite par nom.
 */
export function trierCategories(
  lignes: readonly LigneCategorie[],
  langue = 'en',
): LigneCategorie[] {
  const collateur = new Intl.Collator(langue, { sensitivity: 'base', numeric: true });
  return [...lignes].sort(
    (a, b) =>
      (a.ordre ?? Number.MAX_SAFE_INTEGER) - (b.ordre ?? Number.MAX_SAFE_INTEGER) ||
      collateur.compare(a.nom, b.nom),
  );
}

/** Images qui servent de pochette à la catégorie : celle que déclare la fiche, ou `cover.*` / `pochette.*`. */
function pochettesCategorie(cat: CategorieDepot, fiche: FicheBrute | undefined): FichierDepot[] {
  const declaree = texte(fiche?.['pochette']);
  return cat.images.filter(
    (i) =>
      (declaree !== '' && nomDe(i.chemin) === declaree) ||
      NOMS_POCHETTE.includes(sansExtension(nomDe(i.chemin)).toLowerCase()),
  );
}

/** Fichiers d'une catégorie qui sont du contenu (titres, albums, fiches) et non sa propre fiche ou pochette. */
export function fichiersDeContenu(
  categorie: CategorieDepot,
  fiche: FicheBrute | undefined,
): FichierDepot[] {
  const meta = new Set<string>([
    ...(categorie.fiche === undefined ? [] : [categorie.fiche.chemin]),
    ...pochettesCategorie(categorie, fiche).map((i) => i.chemin),
  ]);
  return categorie.fichiers.filter((f) => !meta.has(f.chemin));
}

function serialiser(fiche: FicheBrute): string {
  FicheCategorieSchema.parse(fiche);
  return `${JSON.stringify(fiche, null, 2)}\n`;
}

function poser(fiche: FicheBrute, cle: string, valeur: unknown): void {
  if (valeur === undefined) Reflect.deleteProperty(fiche, cle);
  else fiche[cle] = valeur;
}

/** Création d'une catégorie : un dossier avec sa fiche et, si fournie, sa pochette. */
export function planCreationCategorie(entree: {
  formulaire: FormulaireCategorie;
  pochette?: { octets: Uint8Array; extension: string };
  depot: AnalyseDepot;
}): PlanCategorie {
  const { formulaire, depot } = entree;
  const nom = formulaire.nom.trim();
  const dossier = slugifier(nom);
  const erreurs: ErreurCategorie[] = [];
  if (nom === '' || dossier === '') erreurs.push({ champ: 'nom' });
  else if (dossier === CATEGORIE_TOUT || dossier === CATEGORIE_FAVORIS) {
    erreurs.push({ champ: 'reserve', id: dossier });
  } else if (depot.categories.some((d) => slugifier(d) === dossier)) {
    erreurs.push({ champ: 'doublon', id: dossier });
  }
  erreurs.push(...erreursCouleur(formulaire.couleur));
  if (erreurs.length > 0) return { ok: false, erreurs };

  const fiche: FicheBrute = { nom };
  poser(fiche, 'description', formulaire.description.trim() || undefined);
  poser(fiche, 'couleur', formulaire.couleur.trim().toLowerCase() || undefined);
  const racine = `${DOSSIER_MUSIQUE}/${dossier}`;
  const changements: Changement[] = [
    { chemin: `${racine}/categorie.json`, contenu: serialiser(fiche) },
  ];
  if (entree.pochette !== undefined) {
    changements.push({
      chemin: `${racine}/cover${entree.pochette.extension}`,
      contenu: entree.pochette.octets,
    });
  }
  return { ok: true, changements, message: `ajout: catégorie « ${nom} »`, dossier };
}

/** Modification d'une catégorie : nom affiché, description, couleur, pochette. Le dossier ne change jamais. */
export function planModificationCategorie(entree: {
  categorie: CategorieDepot;
  fiche: FicheBrute | undefined;
  formulaire: FormulaireCategorie;
  pochette?: { octets: Uint8Array; extension: string };
}): PlanCategorie {
  const { categorie, fiche, formulaire } = entree;
  const nom = formulaire.nom.trim();
  const erreurs: ErreurCategorie[] = [];
  if (nom === '') erreurs.push({ champ: 'nom' });
  erreurs.push(...erreursCouleur(formulaire.couleur));
  if (erreurs.length > 0) return { ok: false, erreurs };

  const racine = `${DOSSIER_MUSIQUE}/${categorie.dossier}`;
  const nouvelle: FicheBrute = { ...fiche };
  poser(nouvelle, 'nom', nom);
  poser(nouvelle, 'description', formulaire.description.trim() || undefined);
  poser(nouvelle, 'couleur', formulaire.couleur.trim().toLowerCase() || undefined);

  const changements: Changement[] = [];
  if (entree.pochette !== undefined) {
    const cible = `${racine}/cover${entree.pochette.extension}`;
    changements.push({ chemin: cible, contenu: entree.pochette.octets });
    for (const image of pochettesCategorie(categorie, fiche)) {
      if (image.chemin !== cible) changements.push({ chemin: image.chemin, supprimer: true });
    }
    // `cover.*` est trouvée automatiquement : plus de déclaration dans la fiche.
    poser(nouvelle, 'pochette', undefined);
  }
  if (fiche === undefined || !memeContenu(fiche, nouvelle)) {
    changements.push({
      chemin: categorie.fiche?.chemin ?? `${racine}/categorie.json`,
      contenu: serialiser(nouvelle),
    });
  }
  return {
    ok: true,
    changements,
    message: `modification: catégorie « ${nom} »`,
    dossier: categorie.dossier,
  };
}

/**
 * Suppression d'une catégorie. Si elle contient des titres ou des albums, `destination` indique la
 * catégorie qui les reçoit (leurs fichiers sont déplacés sans être renvoyés) ; sinon seule sa fiche et
 * sa pochette sont retirées.
 */
export function planSuppressionCategorie(entree: {
  categorie: CategorieDepot;
  fiche: FicheBrute | undefined;
  destination?: string;
  depot: AnalyseDepot;
}): PlanCategorie {
  const { categorie, fiche, depot } = entree;
  const nom = texte(fiche?.['nom']) || titreDepuisNomFichier(categorie.dossier);
  const meta = new Set<string>([
    ...(categorie.fiche === undefined ? [] : [categorie.fiche.chemin]),
    ...pochettesCategorie(categorie, fiche).map((i) => i.chemin),
  ]);
  const contenu = fichiersDeContenu(categorie, fiche);
  const changements: Changement[] = [];

  if (contenu.length > 0) {
    const destination = entree.destination;
    if (
      destination === undefined ||
      destination === categorie.dossier ||
      !depot.categories.includes(destination)
    ) {
      return { ok: false, erreurs: [{ champ: 'destination' }] };
    }
    const racineSource = `${DOSSIER_MUSIQUE}/${categorie.dossier}/`;
    const racineCible = `${DOSSIER_MUSIQUE}/${destination}/`;
    const cible = (chemin: string): string => `${racineCible}${chemin.slice(racineSource.length)}`;
    const conflits = contenu.map((f) => cible(f.chemin)).filter((c) => depot.chemins.has(c));
    // Deux fichiers de noms voisins (« A B » et « a-b ») donneraient le même identifiant.
    const idsPris = new Set([
      ...depot.pistes.filter((p) => p.album === undefined).map(identifiantPisteDepot),
      ...depot.albums.map(identifiantAlbumDepot),
    ]);
    for (const piste of categorie.pistes.filter((p) => p.album === undefined)) {
      const id = identifiantPisteDepot({ categorie: destination, base: piste.base });
      if (idsPris.has(id)) conflits.push(cible(piste.mp3.chemin));
    }
    for (const album of categorie.albums) {
      const id = identifiantAlbumDepot({ categorie: destination, dossier: album.dossier });
      if (idsPris.has(id)) conflits.push(`${racineCible}${album.dossier}`);
    }
    if (conflits.length > 0) {
      return { ok: false, erreurs: [{ champ: 'conflit', chemins: [...new Set(conflits)].sort() }] };
    }
    for (const fichier of contenu) {
      changements.push({ chemin: cible(fichier.chemin), sha: fichier.sha });
      changements.push({ chemin: fichier.chemin, supprimer: true });
    }
  }
  for (const chemin of meta) changements.push({ chemin, supprimer: true });

  const message =
    contenu.length === 0
      ? `suppression: catégorie « ${nom} »`
      : `suppression: catégorie « ${nom} » (contenu déplacé vers ${entree.destination ?? ''})`;
  return { ok: true, changements, message, dossier: categorie.dossier };
}

/**
 * Enregistre l'ordre d'affichage des catégories : chaque fiche reçoit son `ordre` (1, 2, 3…). Seules les
 * fiches qui changent sont écrites ; une catégorie sans fiche en reçoit une qui ne contient que l'ordre.
 */
export function planOrdreCategories(
  ordre: readonly CategorieDepot[],
  fiches: ReadonlyMap<string, FicheBrute | undefined>,
): { changements: Changement[]; message: string } {
  const changements: Changement[] = [];
  ordre.forEach((categorie, index) => {
    const fiche = fiches.get(categorie.dossier);
    if (fiche?.['ordre'] === index + 1) return;
    changements.push({
      chemin: categorie.fiche?.chemin ?? `${DOSSIER_MUSIQUE}/${categorie.dossier}/categorie.json`,
      contenu: serialiser({ ...fiche, ordre: index + 1 }),
    });
  });
  return { changements, message: 'modification: ordre des catégories' };
}
