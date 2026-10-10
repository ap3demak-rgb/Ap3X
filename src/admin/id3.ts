// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Tags d'un MP3 utiles pour préremplir une fiche. */
export interface TagsId3 {
  titre?: string;
  artiste?: string;
  album?: string;
  /** Date brute du tag (« 2024 », « 2024-05-03 »…). */
  date?: string;
  genre?: string;
  commentaire?: string;
  /** Numéro de la piste dans l'album (« 3/12 » donne 3). */
  numero?: number;
  /** Numéro du disque (« 1/2 » donne 1). */
  disque?: number;
  pochette?: { type: string; donnees: Uint8Array };
}

const TAILLE_ENTETE = 10;

/** Entier « synchsafe » (7 bits utiles par octet), utilisé par ID3v2 pour les tailles. */
function entierSynchsafe(o: Uint8Array, debut: number): number {
  return (
    ((o[debut] ?? 0) & 0x7f) * 0x200000 +
    ((o[debut + 1] ?? 0) & 0x7f) * 0x4000 +
    ((o[debut + 2] ?? 0) & 0x7f) * 0x80 +
    ((o[debut + 3] ?? 0) & 0x7f)
  );
}

function entier32(o: Uint8Array, debut: number): number {
  return (
    (o[debut] ?? 0) * 0x1000000 +
    (o[debut + 1] ?? 0) * 0x10000 +
    (o[debut + 2] ?? 0) * 0x100 +
    (o[debut + 3] ?? 0)
  );
}

/** Taille totale d'un tag ID3v2 (en-tête compris) d'après ses 10 premiers octets ; 0 s'il n'y en a pas. */
export function tailleTagId3(entete: Uint8Array): number {
  if (entete.length < TAILLE_ENTETE) return 0;
  if (entete[0] !== 0x49 || entete[1] !== 0x44 || entete[2] !== 0x33) return 0; // « ID3 »
  return TAILLE_ENTETE + entierSynchsafe(entete, 6);
}

/** Texte d'un champ ID3 selon son octet d'encodage (0 latin1, 1 UTF-16 avec BOM, 2 UTF-16 BE, 3 UTF-8). */
function decoder(octets: Uint8Array, encodage: number): string {
  let etiquette = 'iso-8859-1';
  let donnees = octets;
  if (encodage === 1) {
    if (octets[0] === 0xff && octets[1] === 0xfe) {
      etiquette = 'utf-16le';
      donnees = octets.subarray(2);
    } else if (octets[0] === 0xfe && octets[1] === 0xff) {
      etiquette = 'utf-16be';
      donnees = octets.subarray(2);
    } else {
      etiquette = 'utf-16le';
    }
  } else if (encodage === 2) {
    etiquette = 'utf-16be';
  } else if (encodage === 3) {
    etiquette = 'utf-8';
  }
  return new TextDecoder(etiquette).decode(donnees).replace(/\0+$/g, '');
}

/** Position de la fin d'une chaîne terminée par un zéro (deux octets pour l'UTF-16) à partir de `debut`. */
function finDeChaine(o: Uint8Array, debut: number, encodage: number): number {
  const large = encodage === 1 || encodage === 2;
  for (let i = debut; i < o.length; i += large ? 2 : 1) {
    if (o[i] === 0 && (!large || o[i + 1] === 0)) return i;
  }
  return o.length;
}

function premierTexte(corps: Uint8Array): string {
  const encodage = corps[0] ?? 0;
  const texte = decoder(corps.subarray(1), encodage);
  // Les tags v2.4 peuvent contenir plusieurs valeurs séparées par un zéro : on garde la première.
  return (texte.split('\0')[0] ?? '').trim();
}

/** « 3/12 » donne 3 ; renvoie `undefined` si le texte ne commence pas par un nombre. */
function nombreAvantBarre(texte: string): number | undefined {
  const n = Number.parseInt(texte, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function lireCommentaire(corps: Uint8Array): string {
  const encodage = corps[0] ?? 0;
  const debutDescription = 4; // encodage + langue sur 3 octets
  const fin = finDeChaine(corps, debutDescription, encodage);
  const large = encodage === 1 || encodage === 2;
  return decoder(corps.subarray(fin + (large ? 2 : 1)), encodage).trim();
}

function lireImage(corps: Uint8Array, v22: boolean): TagsId3['pochette'] {
  const encodage = corps[0] ?? 0;
  let position: number;
  let type: string;
  if (v22) {
    const format = decoder(corps.subarray(1, 4), 0).toLowerCase();
    type = format === 'png' ? 'image/png' : 'image/jpeg';
    position = 4;
  } else {
    const finType = finDeChaine(corps, 1, 0);
    type = decoder(corps.subarray(1, finType), 0).toLowerCase();
    if (type === 'image/jpg' || type === '') type = 'image/jpeg';
    position = finType + 1;
  }
  position += 1; // type d'image (face avant, etc.)
  const finDescription = finDeChaine(corps, position, encodage);
  const large = encodage === 1 || encodage === 2;
  const donnees = corps.subarray(finDescription + (large ? 2 : 1));
  return donnees.length > 0 ? { type, donnees: donnees.slice() } : undefined;
}

/**
 * Lit les tags d'un tag ID3v2 complet (versions 2.2, 2.3 et 2.4). Renvoie un objet vide si les octets ne
 * commencent pas par un tag ID3v2 ; un tag tronqué ou abîmé donne les champs lus avant l'anomalie.
 */
export function lireTagsId3(octets: Uint8Array): TagsId3 {
  const tags: TagsId3 = {};
  if (tailleTagId3(octets) === 0) return tags;
  const version = octets[3] ?? 0;
  if (version < 2 || version > 4) return tags;
  const v22 = version === 2;
  const tailleId = v22 ? 3 : 4;
  const tailleEntete = v22 ? 6 : 10;
  const fin = Math.min(tailleTagId3(octets), octets.length);

  let position = TAILLE_ENTETE;
  // En-tête étendu (v2.3 et 2.4) : on le saute.
  if (!v22 && ((octets[5] ?? 0) & 0x40) !== 0) {
    position += version === 4 ? entierSynchsafe(octets, position) : entier32(octets, position) + 4;
  }

  while (position + tailleEntete <= fin) {
    if (octets[position] === 0) break; // bourrage : plus de trames
    const id = decoder(octets.subarray(position, position + tailleId), 0);
    let taille: number;
    if (v22) {
      taille =
        (octets[position + 3] ?? 0) * 0x10000 +
        (octets[position + 4] ?? 0) * 0x100 +
        (octets[position + 5] ?? 0);
    } else {
      taille =
        version === 4 ? entierSynchsafe(octets, position + 4) : entier32(octets, position + 4);
    }
    const debutCorps = position + tailleEntete;
    if (taille <= 0 || debutCorps + taille > fin) break;
    const corps = octets.subarray(debutCorps, debutCorps + taille);
    position = debutCorps + taille;

    switch (id) {
      case 'TIT2':
      case 'TT2':
        tags.titre ??= premierTexte(corps);
        break;
      case 'TPE1':
      case 'TP1':
        tags.artiste ??= premierTexte(corps);
        break;
      case 'TALB':
      case 'TAL':
        tags.album ??= premierTexte(corps);
        break;
      case 'TDRC':
      case 'TYER':
      case 'TYE':
        tags.date ??= premierTexte(corps);
        break;
      case 'TCON':
      case 'TCO': {
        const genre = premierTexte(corps);
        // « (17) » ou « 17 » : genre numérique de l'ID3v1, sans nom exploitable.
        if (genre !== '' && !/^\(?\d+\)?$/.test(genre)) tags.genre ??= genre;
        break;
      }
      case 'TRCK':
      case 'TRK':
        tags.numero ??= nombreAvantBarre(premierTexte(corps));
        break;
      case 'TPOS':
      case 'TPA':
        tags.disque ??= nombreAvantBarre(premierTexte(corps));
        break;
      case 'COMM':
      case 'COM':
        tags.commentaire ??= lireCommentaire(corps);
        break;
      case 'APIC':
      case 'PIC':
        tags.pochette ??= lireImage(corps, v22);
        break;
      default:
        break;
    }
  }
  // Les champs vides ne servent à rien pour préremplir un formulaire.
  return Object.fromEntries(Object.entries(tags).filter(([, valeur]) => valeur !== '')) as TagsId3;
}

/** Lit les tags d'un fichier MP3 en ne chargeant que le début du fichier (le tag ID3v2). */
export async function lireTagsFichier(fichier: Blob): Promise<TagsId3> {
  const entete = new Uint8Array(await fichier.slice(0, TAILLE_ENTETE).arrayBuffer());
  const taille = tailleTagId3(entete);
  if (taille === 0) return {};
  return lireTagsId3(new Uint8Array(await fichier.slice(0, taille).arrayBuffer()));
}
