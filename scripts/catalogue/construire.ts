// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import { basename, extname, join } from 'node:path';
import { parseFile, selectCover } from 'music-metadata';
import type { ZodType } from 'zod';
import {
  ANNEE_COPYRIGHT_PAR_DEFAUT,
  ARTISTE_PAR_DEFAUT,
  CatalogueSchema,
  FicheAlbumSchema,
  FichePisteSchema,
  FicheCategorieSchema,
  type Album,
  type Catalogue,
  type Categorie,
  type FicheAlbum,
  type FichePiste,
  type Piste,
} from '../../src/catalogue/schemas.ts';
import {
  arrondir,
  deduireTypeAlbum,
  extraireHashtags,
  fusionnerHashtags,
  normaliserDate,
  slugifier,
  titreDepuisNomFichier,
  urlRelative,
} from './outils.ts';

export interface Options {
  /** Dossier des musiques, par exemple public/musique. */
  racine: string;
  /** Dossier où sont extraites les pochettes intégrées aux MP3, par exemple public/pochettes. */
  dossierPochettes: string;
}

export interface Resultat {
  catalogue: Catalogue;
  erreurs: string[];
  avertissements: string[];
}

const EXTENSIONS_IMAGE = ['.jpg', '.jpeg', '.png', '.webp'];
const NOMS_POCHETTE = ['cover', 'pochette'];

interface Contexte {
  options: Options;
  erreurs: string[];
  avertissements: string[];
  /** Identifiant → chemin source, pour détecter les collisions. */
  identifiants: Map<string, string>;
}

const estMp3 = (nom: string): boolean => extname(nom).toLowerCase() === '.mp3';

async function lireFiche<T>(
  chemin: string,
  schema: ZodType<T>,
  contexte: Contexte,
): Promise<T | undefined> {
  if (!existsSync(chemin)) return undefined;
  let brut: unknown;
  try {
    brut = JSON.parse(await readFile(chemin, 'utf8'));
  } catch (erreur) {
    contexte.erreurs.push(`${chemin} : JSON invalide (${(erreur as Error).message})`);
    return undefined;
  }
  const resultat = schema.safeParse(brut);
  if (!resultat.success) {
    for (const probleme of resultat.error.issues) {
      const champ = probleme.path.length > 0 ? ` [${probleme.path.join('.')}]` : '';
      contexte.erreurs.push(`${chemin}${champ} : ${probleme.message}`);
    }
    return undefined;
  }
  return resultat.data;
}

function reserverIdentifiant(identifiant: string, source: string, contexte: Contexte): void {
  const existant = contexte.identifiants.get(identifiant);
  if (existant !== undefined) {
    contexte.erreurs.push(
      `Identifiant « ${identifiant} » en double : ${existant} et ${source} (renommer l'un des deux)`,
    );
  }
  contexte.identifiants.set(identifiant, source);
}

/** Cherche cover.* ou pochette.* dans un dossier ; renvoie le nom du fichier. */
async function trouverPochetteDossier(dossier: string): Promise<string | undefined> {
  const noms = await readdir(dossier);
  return noms
    .sort()
    .find(
      (nom) =>
        EXTENSIONS_IMAGE.includes(extname(nom).toLowerCase()) &&
        NOMS_POCHETTE.includes(basename(nom, extname(nom)).toLowerCase()),
    );
}

async function resoudrePochette(
  dossier: string,
  segments: string[],
  declaree: string | undefined,
  contexte: Contexte,
): Promise<string | undefined> {
  const nom = declaree ?? (await trouverPochetteDossier(dossier));
  if (nom === undefined) return undefined;
  if (!existsSync(join(dossier, nom))) {
    contexte.erreurs.push(`${join(dossier, nom)} : pochette introuvable`);
    return undefined;
  }
  return `musique/${urlRelative(...segments, nom)}`;
}

interface PisteSource {
  piste: Piste;
  /** Nom de fichier MP3 (avec extension), pour relier la piste à la liste d'un album. */
  nomFichier: string;
}

async function lirePiste(
  dossier: string,
  segments: string[],
  nomFichier: string,
  categorie: string,
  album: { id: string; artiste: string; date: string | undefined } | undefined,
  contexte: Contexte,
): Promise<PisteSource | undefined> {
  const chemin = join(dossier, nomFichier);
  const base = basename(nomFichier, extname(nomFichier));
  const fiche: FichePiste =
    (await lireFiche(join(dossier, `${base}.json`), FichePisteSchema, contexte)) ??
    FichePisteSchema.parse({});
  if (!fiche.visible) {
    contexte.avertissements.push(`${chemin} : piste masquée, absente du catalogue`);
    return undefined;
  }

  let tags: Awaited<ReturnType<typeof parseFile>> | undefined;
  try {
    tags = await parseFile(chemin);
  } catch (erreur) {
    contexte.erreurs.push(`${chemin} : MP3 illisible (${(erreur as Error).message})`);
    return undefined;
  }
  const { common, format } = tags;
  if (common.title === undefined) {
    contexte.avertissements.push(
      `${chemin} : pas de tag ID3 de titre, utilisation du nom de fichier`,
    );
  }
  if (format.duration === undefined) {
    contexte.erreurs.push(`${chemin} : durée introuvable`);
    return undefined;
  }

  const identifiant = [
    categorie,
    ...(album ? [slugifier(segments.at(-1) ?? '')] : []),
    slugifier(base),
  ]
    .filter((s) => s !== '')
    .join('--');
  reserverIdentifiant(identifiant, chemin, contexte);

  const titre = fiche.titre ?? common.title ?? titreDepuisNomFichier(base);
  const artiste = fiche.artiste ?? common.artist ?? album?.artiste ?? ARTISTE_PAR_DEFAUT;
  const date = fiche.date ?? normaliserDate(common.date ?? common.year) ?? album?.date;
  const description = fiche.description ?? common.comment?.[0]?.text ?? '';

  // Pas de détection automatique ici : cover.* du dossier est la pochette de l'album ou de la catégorie.
  let pochette =
    fiche.pochette !== undefined
      ? await resoudrePochette(dossier, segments, fiche.pochette, contexte)
      : undefined;
  if (fiche.pochette === undefined) {
    // La pochette intégrée au MP3 sert de pochette à la piste si la fiche n'en déclare pas.
    const integree = selectCover(common.picture);
    if (integree !== null && integree !== undefined) {
      const extension = integree.format.includes('png')
        ? 'png'
        : integree.format.includes('webp')
          ? 'webp'
          : 'jpg';
      await mkdir(contexte.options.dossierPochettes, { recursive: true });
      await writeFile(
        join(contexte.options.dossierPochettes, `${identifiant}.${extension}`),
        integree.data,
      );
      pochette = `pochettes/${urlRelative(`${identifiant}.${extension}`)}`;
    }
  }

  const annee = date !== undefined ? Number(date.slice(0, 4)) : ANNEE_COPYRIGHT_PAR_DEFAUT;
  const piste: Piste = {
    id: identifiant,
    titre,
    artiste,
    description,
    hashtags: fusionnerHashtags(fiche.hashtags, extraireHashtags(description)),
    ...(pochette !== undefined && { pochette }),
    ...(date !== undefined && { date }),
    categorie,
    ...(album !== undefined && { album: album.id }),
    duree: arrondir(format.duration, 2),
    fichier: `musique/${urlRelative(...segments, nomFichier)}`,
    telechargement: fiche.telechargement,
    licence: fiche.licence,
    copyright: fiche.copyright ?? `© ${annee} ${ARTISTE_PAR_DEFAUT}`,
  };
  return { piste, nomFichier };
}

/** Signale les fiches .json qui ne correspondent à aucun MP3 ni à un fichier réservé. */
function signalerFichesOrphelines(
  dossier: string,
  noms: string[],
  reserves: string[],
  contexte: Contexte,
): void {
  const mp3 = new Set(noms.filter(estMp3).map((nom) => basename(nom, extname(nom))));
  for (const nom of noms) {
    if (extname(nom).toLowerCase() !== '.json' || reserves.includes(nom)) continue;
    if (!mp3.has(basename(nom, '.json'))) {
      contexte.avertissements.push(`${join(dossier, nom)} : fiche sans MP3 correspondant`);
    }
  }
}

async function lireAlbum(
  dossier: string,
  segments: string[],
  categorie: string,
  fiche: FicheAlbum,
  contexte: Contexte,
): Promise<{ album: Album; pistes: Piste[] } | undefined> {
  const idAlbum = `${categorie}--${slugifier(segments.at(-1) ?? '')}`;
  reserverIdentifiant(idAlbum, dossier, contexte);

  const noms = (await readdir(dossier)).sort();
  signalerFichesOrphelines(dossier, noms, ['album.json'], contexte);
  const mp3Presents = noms.filter(estMp3);

  const listes = new Set<string>();
  for (const entree of fiche.pistes) {
    if (listes.has(entree.fichier)) {
      contexte.erreurs.push(
        `${join(dossier, 'album.json')} : piste listée deux fois « ${entree.fichier} »`,
      );
    }
    listes.add(entree.fichier);
    if (!mp3Presents.includes(entree.fichier)) {
      contexte.erreurs.push(
        `${join(dossier, 'album.json')} : piste introuvable « ${entree.fichier} »`,
      );
    }
  }
  for (const orphelin of mp3Presents.filter((nom) => !listes.has(nom))) {
    contexte.avertissements.push(
      `${join(dossier, orphelin)} : piste absente de album.json, ignorée (ajoutez-la à la liste « pistes »)`,
    );
  }

  const artiste = fiche.artiste ?? ARTISTE_PAR_DEFAUT;
  const contexteAlbum = { id: idAlbum, artiste, date: fiche.date };
  const ordonnees = [...fiche.pistes]
    .map((entree, position) => ({ ...entree, position }))
    .sort((a, b) => a.disque - b.disque || a.position - b.position);

  const pistes: Piste[] = [];
  const compteurs = new Map<number, number>();
  for (const entree of ordonnees) {
    if (!mp3Presents.includes(entree.fichier)) continue;
    const source = await lirePiste(
      dossier,
      segments,
      entree.fichier,
      categorie,
      contexteAlbum,
      contexte,
    );
    if (source === undefined) continue;
    const numero = (compteurs.get(entree.disque) ?? 0) + 1;
    compteurs.set(entree.disque, numero);
    pistes.push({ ...source.piste, numero, disque: entree.disque });
  }
  if (pistes.length === 0) {
    contexte.avertissements.push(`${dossier} : aucune piste visible, album absent du catalogue`);
    return undefined;
  }

  const pochette = await resoudrePochette(dossier, segments, fiche.pochette, contexte);
  const dates = pistes.map((p) => p.date).filter((d): d is string => d !== undefined);
  const date = fiche.date ?? dates.sort().at(-1);
  const annee = date !== undefined ? Number(date.slice(0, 4)) : ANNEE_COPYRIGHT_PAR_DEFAUT;
  const description = fiche.description ?? '';

  const pistesAvecPochette = pistes.map((piste) =>
    piste.pochette === undefined && pochette !== undefined ? { ...piste, pochette } : piste,
  );
  const album: Album = {
    id: idAlbum,
    titre: fiche.titre,
    artiste,
    type: fiche.type ?? deduireTypeAlbum(pistes.length),
    ...(date !== undefined && { date }),
    description,
    ...(pochette !== undefined && { pochette }),
    hashtags: fusionnerHashtags(fiche.hashtags, extraireHashtags(description)),
    licence: fiche.licence,
    copyright: fiche.copyright ?? `© ${annee} ${ARTISTE_PAR_DEFAUT}`,
    ...(fiche.reference !== undefined && { reference: fiche.reference }),
    categorie,
    pistes: pistesAvecPochette.map((p) => p.id),
    nombrePistes: pistesAvecPochette.length,
    duree: arrondir(
      pistesAvecPochette.reduce((somme, p) => somme + p.duree, 0),
      2,
    ),
  };
  return { album, pistes: pistesAvecPochette };
}

export async function construireCatalogue(options: Options): Promise<Resultat> {
  const contexte: Contexte = { options, erreurs: [], avertissements: [], identifiants: new Map() };
  const categories: Categorie[] = [];
  const albums: Album[] = [];
  const pistes: Piste[] = [];

  const entrees = existsSync(options.racine)
    ? (await readdir(options.racine, { withFileTypes: true })).sort((a, b) =>
        a.name.localeCompare(b.name),
      )
    : [];

  for (const entree of entrees) {
    if (!entree.isDirectory()) {
      if (estMp3(entree.name)) {
        contexte.erreurs.push(
          `${join(options.racine, entree.name)} : un MP3 doit se trouver dans un dossier de catégorie`,
        );
      }
      continue;
    }
    const dossier = join(options.racine, entree.name);
    const slug = slugifier(entree.name);
    if (slug === '') {
      contexte.erreurs.push(`${dossier} : nom de catégorie inutilisable`);
      continue;
    }
    reserverIdentifiant(slug, dossier, contexte);
    const fiche = await lireFiche(join(dossier, 'categorie.json'), FicheCategorieSchema, contexte);
    const noms = (await readdir(dossier, { withFileTypes: true })).sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    signalerFichesOrphelines(
      dossier,
      noms.filter((n) => n.isFile()).map((n) => n.name),
      ['categorie.json'],
      contexte,
    );

    let nombrePistes = 0;
    let nombreAlbums = 0;
    for (const element of noms) {
      if (element.isFile() && estMp3(element.name)) {
        const source = await lirePiste(
          dossier,
          [entree.name],
          element.name,
          slug,
          undefined,
          contexte,
        );
        if (source !== undefined) {
          pistes.push(source.piste);
          nombrePistes += 1;
        }
      } else if (element.isDirectory()) {
        const dossierAlbum = join(dossier, element.name);
        const ficheAlbum = await lireFiche(
          join(dossierAlbum, 'album.json'),
          FicheAlbumSchema,
          contexte,
        );
        if (ficheAlbum === undefined) {
          if (!existsSync(join(dossierAlbum, 'album.json'))) {
            const contientMp3 = (await readdir(dossierAlbum)).some(estMp3);
            if (contientMp3) {
              contexte.erreurs.push(
                `${dossierAlbum} : sous-dossier avec des MP3 mais sans album.json`,
              );
            }
          }
          continue;
        }
        if (!ficheAlbum.visible) {
          contexte.avertissements.push(`${dossierAlbum} : album masqué, absent du catalogue`);
          continue;
        }
        const resultat = await lireAlbum(
          dossierAlbum,
          [entree.name, element.name],
          slug,
          ficheAlbum,
          contexte,
        );
        if (resultat !== undefined) {
          albums.push(resultat.album);
          pistes.push(...resultat.pistes);
          nombrePistes += resultat.pistes.length;
          nombreAlbums += 1;
        }
      }
    }

    const pochette = await resoudrePochette(dossier, [entree.name], fiche?.pochette, contexte);
    categories.push({
      slug,
      nom: fiche?.nom ?? titreDepuisNomFichier(entree.name),
      description: fiche?.description ?? '',
      ...(fiche?.couleur !== undefined && { couleur: fiche.couleur }),
      ...(pochette !== undefined && { pochette }),
      nombrePistes,
      nombreAlbums,
    });
  }

  // Avertit des doublons probables (même titre et même artiste dans une catégorie).
  const vus = new Map<string, string>();
  for (const piste of pistes) {
    const cle = `${piste.categorie}|${piste.artiste.toLowerCase()}|${piste.titre.toLowerCase()}`;
    const autre = vus.get(cle);
    if (autre !== undefined) {
      contexte.avertissements.push(
        `Doublon probable : « ${piste.titre} » (${autre} et ${piste.id})`,
      );
    }
    vus.set(cle, piste.id);
  }

  const index = new Map<string, string[]>();
  for (const piste of pistes) {
    for (const hashtag of piste.hashtags) {
      index.set(hashtag, [...(index.get(hashtag) ?? []), piste.id]);
    }
  }
  const hashtags = [...index.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([nom, ids]) => ({ nom, pistes: ids }));

  const brut = {
    version: 1 as const,
    categories: categories.sort((a, b) => a.nom.localeCompare(b.nom)),
    albums: albums.sort((a, b) => a.id.localeCompare(b.id)),
    pistes: pistes.sort((a, b) => a.id.localeCompare(b.id)),
    hashtags,
  };
  const validation = CatalogueSchema.safeParse(brut);
  if (!validation.success) {
    for (const probleme of validation.error.issues) {
      contexte.erreurs.push(`catalogue : ${probleme.path.join('.')} ${probleme.message}`);
    }
  }
  return {
    catalogue: validation.success ? validation.data : (brut as Catalogue),
    erreurs: contexte.erreurs,
    avertissements: contexte.avertissements,
  };
}
