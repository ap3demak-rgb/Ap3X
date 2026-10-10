// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { z } from 'zod';
import { adresseLien, ENTREES_MENU, LIMITES_FOND } from './reglages';

const Texte = z.string().trim().min(1);

/**
 * Schéma strict de `public/site.json`, utilisé au build, par le contrôle `npm run verifier` et par la page
 * d'administration. Au runtime, le site utilise la lecture tolérante `lireReglages` (sans zod).
 */
export const ReglagesSchema = z
  .object({
    version: z.literal(1),
    nom: Texte.max(60),
    slogan: z.string().trim().max(160),
    description: Texte.max(300),
    liens: z
      .array(
        z
          .object({
            nom: Texte.max(40),
            url: z
              .string()
              .refine(
                (u) => adresseLien(u) !== undefined,
                'Adresse http, https ou mailto attendue',
              ),
          })
          .strict(),
      )
      .max(12),
    options: z.object({ telechargements: z.boolean(), aleatoire: z.boolean() }).strict(),
    accueil: z.object({ misesEnAvant: z.array(Texte).max(12) }).strict(),
    fond: z
      .object({
        actif: z.boolean(),
        intensite: z.number().min(LIMITES_FOND.intensiteMin).max(LIMITES_FOND.intensiteMax),
        vitesse: z.number().min(LIMITES_FOND.vitesseMin).max(LIMITES_FOND.vitesseMax),
        visualiseur: z.boolean(),
      })
      .strict(),
    menu: z.object({ masques: z.array(z.enum(ENTREES_MENU)) }).strict(),
  })
  .strict();

export type ReglagesStricts = z.infer<typeof ReglagesSchema>;
