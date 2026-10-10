// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

/** Plus grand côté d'une pochette envoyée : le build en tire ensuite ses versions de 960, 320 et 1200 px. */
export const COTE_MAX_POCHETTE = 1200;

export interface Dimensions {
  largeur: number;
  hauteur: number;
}

/** Dimensions réduites pour que le plus grand côté ne dépasse pas `max` ; jamais d'agrandissement. */
export function dimensionsReduites(source: Dimensions, max = COTE_MAX_POCHETTE): Dimensions {
  const plusGrand = Math.max(source.largeur, source.hauteur);
  if (plusGrand <= max) return { ...source };
  const facteur = max / plusGrand;
  return {
    largeur: Math.max(1, Math.round(source.largeur * facteur)),
    hauteur: Math.max(1, Math.round(source.hauteur * facteur)),
  };
}

export interface PochettePreparee {
  blob: Blob;
  /** Extension du format réellement produit : `.webp`, ou `.jpg` si le navigateur ne sait pas encoder le WebP. */
  extension: '.webp' | '.jpg';
  largeur: number;
  hauteur: number;
}

function encoder(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resoudre) => canvas.toBlob(resoudre, type, 0.9));
}

/**
 * Redimensionne une image dans le navigateur et la convertit en WebP (JPEG si le navigateur ne sait pas
 * encoder le WebP, comme certaines versions de Safari). Lève une erreur si le fichier n'est pas une image lisible.
 */
export async function preparerPochette(fichier: Blob): Promise<PochettePreparee> {
  const image = await createImageBitmap(fichier);
  try {
    const { largeur, hauteur } = dimensionsReduites({
      largeur: image.width,
      hauteur: image.height,
    });
    const canvas = document.createElement('canvas');
    canvas.width = largeur;
    canvas.height = hauteur;
    const contexte = canvas.getContext('2d');
    if (contexte === null) throw new Error('Canvas 2D indisponible');
    contexte.drawImage(image, 0, 0, largeur, hauteur);
    const webp = await encoder(canvas, 'image/webp');
    if (webp !== null && webp.type === 'image/webp') {
      return { blob: webp, extension: '.webp', largeur, hauteur };
    }
    const jpeg = await encoder(canvas, 'image/jpeg');
    if (jpeg === null) throw new Error('Encodage de la pochette impossible');
    return { blob: jpeg, extension: '.jpg', largeur, hauteur };
  } finally {
    image.close();
  }
}
