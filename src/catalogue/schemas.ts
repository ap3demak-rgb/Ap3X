// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { z } from 'zod';

/**
 * Schémas partagés entre le script de génération du catalogue, le client et la page d'administration.
 * - « Fiche… » : fichiers JSON écrits à la main (ou par l'admin) à côté des MP3.
 * - « Catalogue… » : contenu de public/catalogue.json, produit par scripts/generer-catalogue.ts.
 */

export const LICENCE_PAR_DEFAUT = 'CC BY-NC-ND 4.0';
export const ARTISTE_PAR_DEFAUT = 'AP3X Records';
export const ANNEE_COPYRIGHT_PAR_DEFAUT = 2026;

export const TYPES_ALBUM = ['single', 'ep', 'lp', 'compilation'] as const;
export const TypeAlbumSchema = z.enum(TYPES_ALBUM);
export type TypeAlbum = z.infer<typeof TypeAlbumSchema>;

/** Date ISO partielle : « 2026 », « 2026-10 » ou « 2026-10-08 ». */
const DateSchema = z
  .string()
  .regex(/^\d{4}(-\d{2}(-\d{2})?)?$/, 'Date attendue : AAAA, AAAA-MM ou AAAA-MM-JJ');
const TexteSchema = z.string().trim().min(1);
const HashtagsSchema = z.array(TexteSchema).default([]);

export const FicheCategorieSchema = z
  .object({
    nom: TexteSchema.optional(),
    description: z.string().optional(),
    couleur: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/, 'Couleur attendue : #RRGGBB')
      .optional(),
    pochette: TexteSchema.optional(),
  })
  .strict();
export type FicheCategorie = z.infer<typeof FicheCategorieSchema>;

export const FichePisteSchema = z
  .object({
    titre: TexteSchema.optional(),
    artiste: TexteSchema.optional(),
    description: z.string().optional(),
    hashtags: HashtagsSchema,
    pochette: TexteSchema.optional(),
    date: DateSchema.optional(),
    visible: z.boolean().default(true),
    telechargement: z.boolean().default(false),
    licence: TexteSchema.default(LICENCE_PAR_DEFAUT),
    copyright: TexteSchema.optional(),
  })
  .strict();
export type FichePiste = z.infer<typeof FichePisteSchema>;

const EntreeAlbumSchema = z.union([
  TexteSchema.transform((fichier) => ({ fichier, disque: 1 })),
  z.object({ fichier: TexteSchema, disque: z.number().int().min(1).default(1) }).strict(),
]);

export const FicheAlbumSchema = z
  .object({
    titre: TexteSchema,
    artiste: TexteSchema.optional(),
    type: TypeAlbumSchema.optional(),
    date: DateSchema.optional(),
    description: z.string().optional(),
    pochette: TexteSchema.optional(),
    hashtags: HashtagsSchema,
    licence: TexteSchema.default(LICENCE_PAR_DEFAUT),
    copyright: TexteSchema.optional(),
    reference: TexteSchema.optional(),
    visible: z.boolean().default(true),
    pistes: z.array(EntreeAlbumSchema).min(1, 'Un album doit lister au moins une piste'),
  })
  .strict();
export type FicheAlbum = z.infer<typeof FicheAlbumSchema>;

export const PisteSchema = z.object({
  id: TexteSchema,
  titre: TexteSchema,
  artiste: TexteSchema,
  description: z.string(),
  hashtags: z.array(TexteSchema),
  pochette: TexteSchema.optional(),
  date: DateSchema.optional(),
  categorie: TexteSchema,
  album: TexteSchema.optional(),
  numero: z.number().int().min(1).optional(),
  disque: z.number().int().min(1).optional(),
  duree: z.number().min(0),
  fichier: TexteSchema,
  telechargement: z.boolean(),
  licence: TexteSchema,
  copyright: TexteSchema,
});
export type Piste = z.infer<typeof PisteSchema>;

export const AlbumSchema = z.object({
  id: TexteSchema,
  titre: TexteSchema,
  artiste: TexteSchema,
  type: TypeAlbumSchema,
  date: DateSchema.optional(),
  description: z.string(),
  pochette: TexteSchema.optional(),
  hashtags: z.array(TexteSchema),
  licence: TexteSchema,
  copyright: TexteSchema,
  reference: TexteSchema.optional(),
  categorie: TexteSchema,
  pistes: z.array(TexteSchema).min(1),
  nombrePistes: z.number().int().min(1),
  duree: z.number().min(0),
});
export type Album = z.infer<typeof AlbumSchema>;

export const CategorieSchema = z.object({
  slug: TexteSchema,
  nom: TexteSchema,
  description: z.string(),
  couleur: z.string().optional(),
  pochette: TexteSchema.optional(),
  nombrePistes: z.number().int().min(0),
  nombreAlbums: z.number().int().min(0),
});
export type Categorie = z.infer<typeof CategorieSchema>;

export const HashtagSchema = z.object({
  nom: TexteSchema,
  pistes: z.array(TexteSchema).min(1),
});
export type Hashtag = z.infer<typeof HashtagSchema>;

export const CatalogueSchema = z
  .object({
    version: z.literal(1),
    categories: z.array(CategorieSchema),
    albums: z.array(AlbumSchema),
    pistes: z.array(PisteSchema),
    hashtags: z.array(HashtagSchema),
  })
  .superRefine((catalogue, ctx) => {
    const pistes = new Set(catalogue.pistes.map((p) => p.id));
    const albums = new Set(catalogue.albums.map((a) => a.id));
    const categories = new Set(catalogue.categories.map((c) => c.slug));
    const signaler = (message: string): void => {
      ctx.addIssue({ code: 'custom', message });
    };
    if (pistes.size !== catalogue.pistes.length) signaler('Identifiants de pistes en double');
    if (albums.size !== catalogue.albums.length) signaler("Identifiants d'albums en double");
    for (const piste of catalogue.pistes) {
      if (!categories.has(piste.categorie)) signaler(`Piste ${piste.id} : catégorie inconnue`);
      if (piste.album !== undefined && !albums.has(piste.album)) {
        signaler(`Piste ${piste.id} : album inconnu`);
      }
    }
    for (const album of catalogue.albums) {
      if (!categories.has(album.categorie)) signaler(`Album ${album.id} : catégorie inconnue`);
      for (const id of album.pistes) {
        if (!pistes.has(id)) signaler(`Album ${album.id} : piste inconnue « ${id} »`);
      }
    }
    for (const hashtag of catalogue.hashtags) {
      for (const id of hashtag.pistes) {
        if (!pistes.has(id)) signaler(`Hashtag ${hashtag.nom} : piste inconnue « ${id} »`);
      }
    }
  });
export type Catalogue = z.infer<typeof CatalogueSchema>;
