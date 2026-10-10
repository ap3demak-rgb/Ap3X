// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t } from '../i18n';
import { definirTitrePage, titrePage } from './commun';

const META_ROBOTS = 'meta[name="robots"][data-admin]';

/** Interdit l'indexation tant que la page d'administration est affichée. */
function marquerNonIndexee(): void {
  if (document.head.querySelector(META_ROBOTS) !== null) return;
  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  meta.dataset['admin'] = '';
  document.head.append(meta);
}

/** Retire la consigne dès qu'une autre page est affichée. */
export function retirerNonIndexee(): void {
  document.head.querySelector(META_ROBOTS)?.remove();
}

/**
 * Page `#/admin` : non liée depuis le site, non indexée. Le code d'administration (client GitHub,
 * écrans) est un morceau à part, chargé seulement ici : les visiteurs ordinaires ne le téléchargent jamais.
 */
export function pageAdmin(): HTMLElement {
  marquerNonIndexee();
  definirTitrePage(t('admin.titre'));
  const section = document.createElement('section');
  section.append(titrePage(t('admin.titre')));
  import('../admin/ecran')
    .then(({ construireEcran }) => section.append(construireEcran()))
    .catch((erreur: unknown) => {
      console.error(erreur);
      const message = document.createElement('p');
      message.setAttribute('role', 'alert');
      message.textContent = t('erreur.chargement');
      section.append(message);
    });
  return section;
}
