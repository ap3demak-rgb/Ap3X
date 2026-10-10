// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv, type CleI18n } from '../i18n';
import { ErreurFicheIllisible } from './edition';
import { ErreurGitHub } from './github';

/**
 * Message traduit d'une erreur d'administration. Une erreur inattendue est affichée comme « autre » et
 * journalisée (jamais avec le jeton : le client ne l'écrit dans aucun message).
 */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurGitHub) {
    if (erreur.code === 'limite' && erreur.reessayerApres !== undefined) {
      const minutes = Math.max(1, Math.ceil(erreur.reessayerApres / 60));
      return tv('admin.erreur.limite_delai', { minutes });
    }
    return t(`admin.erreur.${erreur.code}` satisfies CleI18n);
  }
  if (erreur instanceof ErreurFicheIllisible) return t('admin.erreur.fiche');
  console.error(erreur);
  return t('admin.erreur.autre');
}
