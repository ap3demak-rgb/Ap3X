// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { FicheAlbumSchema, FichePisteSchema, FicheCategorieSchema } from '../catalogue/schemas';
import type { AnalyseDepot } from './depot';
import { CHEMIN_REGLAGES, validerReglages } from './site-champs';

export type TypeFichierJson = 'site' | 'manifeste' | 'categorie' | 'album' | 'piste';

/** Fichier de configuration que l'éditeur JSON peut modifier. */
export interface FichierJson {
  chemin: string;
  sha: string;
  type: TypeFichierJson;
}

const MANIFESTE = 'public/manifest.webmanifest';

/** Type d'un fichier d'après son chemin ; `undefined` s'il n'est pas modifiable ici. */
export function typeFichierJson(chemin: string): TypeFichierJson | undefined {
  if (chemin === CHEMIN_REGLAGES) return 'site';
  if (chemin === MANIFESTE) return 'manifeste';
  const segments = chemin.split('/');
  if (segments[0] !== 'public' || segments[1] !== 'musique' || !chemin.endsWith('.json')) {
    return undefined;
  }
  const nom = segments.at(-1);
  if (nom === 'categorie.json' && segments.length === 4) return 'categorie';
  if (nom === 'album.json' && segments.length === 5) return 'album';
  return 'piste';
}

/** Fichiers JSON modifiables du dépôt, triés par chemin : réglages, manifeste, catégories, albums, fiches. */
export function fichiersJsonEditables(depot: AnalyseDepot): FichierJson[] {
  const resultat: FichierJson[] = [];
  for (const [chemin, sha] of depot.empreintes) {
    const type = typeFichierJson(chemin);
    if (type !== undefined) resultat.push({ chemin, sha, type });
  }
  return resultat.sort((a, b) => a.chemin.localeCompare(b.chemin));
}

export type ResultatFichierJson = { ok: true } | { ok: false; detail: string };

/**
 * Valide le texte d'un fichier : JSON correct, puis conforme au schéma de son type (les mêmes schémas
 * que le build). Le manifeste est seulement contrôlé comme objet JSON.
 */
export function validerFichierJson(type: TypeFichierJson, texte: string): ResultatFichierJson {
  let brut: unknown;
  try {
    brut = JSON.parse(texte);
  } catch (erreur) {
    return { ok: false, detail: (erreur as Error).message };
  }
  if (typeof brut !== 'object' || brut === null || Array.isArray(brut)) {
    return { ok: false, detail: 'objet JSON attendu' };
  }
  if (type === 'manifeste') return { ok: true };
  if (type === 'site') {
    const resultat = validerReglages(brut);
    return resultat.ok
      ? { ok: true }
      : {
          ok: false,
          detail: resultat.problemes
            .map((p) => `${p.chemin || '(racine)'} : ${p.message}`)
            .join(' ; '),
        };
  }
  const schema =
    type === 'categorie'
      ? FicheCategorieSchema
      : type === 'album'
        ? FicheAlbumSchema
        : FichePisteSchema;
  const resultat = schema.safeParse(brut);
  if (resultat.success) return { ok: true };
  return {
    ok: false,
    detail: resultat.error.issues
      .map((i) => `${i.path.join('.') || '(racine)'} : ${i.message}`)
      .join(' ; '),
  };
}
