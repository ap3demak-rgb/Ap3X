// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { copierTexte, lienPourCetteApplication } from '../partage';
import { t, tv } from '../i18n';
import { formaterDuree } from '../i18n/format';
import { lecteur } from '../lecteur';
import { annoncer } from './annonceur';

export interface OptionsPartage {
  type: 'piste' | 'album';
  id: string;
  titre: string;
  /** Durée de la piste, pour proposer « Démarrer à … » (pistes seulement). */
  avecInstant?: boolean;
}

let compteur = 0;

/**
 * Bloc de partage : bouton « Copier le lien » et, pour une piste, case « Démarrer à 1:30 » qui ajoute
 * l'instant courant de la lecture au lien. Le résultat est annoncé aux lecteurs d'écran et affiché.
 */
export function blocPartage(options: OptionsPartage): HTMLElement {
  const bloc = document.createElement('div');
  bloc.className = 'partage';

  const bouton = document.createElement('button');
  bouton.type = 'button';
  bouton.className = 'bouton';
  bouton.textContent = t('partage.copier_lien');
  bouton.setAttribute('aria-label', `${t('partage.copier_lien')} : ${options.titre}`);

  const retour = document.createElement('span');
  retour.className = 'carte-meta partage-retour';

  let instantCourant = 0;
  let case_: HTMLInputElement | undefined;
  let libelleCase: HTMLElement | undefined;

  if (options.avecInstant === true) {
    const etiquette = document.createElement('label');
    etiquette.className = 'case';
    case_ = document.createElement('input');
    case_.type = 'checkbox';
    case_.id = `partage-instant-${(compteur += 1)}`;
    libelleCase = document.createElement('span');
    etiquette.append(case_, libelleCase);
    bloc.append(etiquette);

    // Le libellé suit la position de lecture de cette piste, au pas de la seconde.
    const actualiser = (): void => {
      if (!bloc.isConnected && bloc.dataset['monte'] === 'oui') {
        lecteur.removeEventListener('etat', actualiser);
        return;
      }
      if (bloc.isConnected) bloc.dataset['monte'] = 'oui';
      const etat = lecteur.etat();
      const actif = etat.piste?.id === options.id;
      const secondes = actif ? Math.floor(etat.position) : 0;
      if (secondes === instantCourant && libelleCase?.textContent !== '') return;
      instantCourant = secondes;
      if (case_ !== undefined && libelleCase !== undefined) {
        libelleCase.textContent = tv('partage.a_partir_de', { temps: formaterDuree(secondes) });
        case_.disabled = secondes <= 0;
        if (secondes <= 0) case_.checked = false;
      }
    };
    lecteur.addEventListener('etat', actualiser);
    actualiser();
  }

  bouton.addEventListener('click', () => {
    const etat = lecteur.etat();
    const instant =
      case_?.checked === true && etat.piste?.id === options.id
        ? Math.floor(etat.position)
        : undefined;
    const lien = lienPourCetteApplication(options.type, options.id, instant);
    void copierTexte(lien).then((copie) => {
      const message = t(copie ? 'partage.lien_copie' : 'partage.copie_echec');
      retour.textContent = message;
      annoncer(message);
      window.setTimeout(() => {
        retour.textContent = '';
      }, 5000);
    });
  });

  bloc.prepend(bouton);
  bloc.append(retour);
  return bloc;
}
