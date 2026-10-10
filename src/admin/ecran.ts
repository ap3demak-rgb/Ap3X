// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import { t, tv, type CleI18n } from '../i18n';
import { annoncer } from '../ui/annonceur';
import {
  ClientGitHub,
  ErreurGitHub,
  verifierJeton,
  type Deploiement,
  type Utilisateur,
} from './github';
import {
  effacerJeton,
  enregistrerJeton,
  jetonSurAppareil,
  lireJeton,
  nettoyerJeton,
} from './session';

/** Message traduit d'une erreur ; une erreur inattendue est affichée comme « autre » (et journalisée sans jeton). */
export function messageErreur(erreur: unknown): string {
  if (erreur instanceof ErreurGitHub) {
    return t(`admin.erreur.${erreur.code}` satisfies CleI18n);
  }
  console.error(erreur);
  return t('admin.erreur.autre');
}

function element<K extends keyof HTMLElementTagNameMap>(
  nom: K,
  classe?: string,
  texte?: string,
): HTMLElementTagNameMap[K] {
  const noeud = document.createElement(nom);
  if (classe !== undefined) noeud.className = classe;
  if (texte !== undefined) noeud.textContent = texte;
  return noeud;
}

/** Codes d'erreur qui prouvent que le jeton mémorisé ne servira plus. */
const CODES_JETON_PERDU = ['jeton', 'droit', 'introuvable'];

/**
 * Écran d'administration : connexion par jeton, puis état du compte et du dernier déploiement.
 * Le jeton n'est jamais affiché, ni écrit dans la console.
 */
export function construireEcran(): HTMLElement {
  const racine = element('div', 'admin');
  const annonce = element('p', 'carte-meta');
  annonce.setAttribute('role', 'status');
  const zone = element('div');
  racine.append(annonce, zone);

  const afficherConnexion = (erreur?: string): void => {
    zone.replaceChildren(formulaireConnexion(erreur));
    if (erreur !== undefined) annoncer(erreur);
  };

  const afficherSession = (client: ClientGitHub, utilisateur: Utilisateur): void => {
    zone.replaceChildren(
      panneauSession(client, utilisateur, () => {
        effacerJeton();
        afficherConnexion();
      }),
    );
  };

  /** Vérifie le jeton, le mémorise s'il est bon, puis affiche la session. */
  const connecter = async (
    jeton: string,
    resterConnecte: boolean,
    memoriser: boolean,
  ): Promise<void> => {
    annonce.textContent = t('admin.verification');
    const client = new ClientGitHub({ jeton });
    try {
      const utilisateur = await verifierJeton(client);
      if (memoriser) enregistrerJeton(jeton, resterConnecte);
      annonce.textContent = '';
      afficherSession(client, utilisateur);
    } catch (erreur) {
      annonce.textContent = '';
      // Un jeton refusé est oublié ; une panne réseau ou une limite ne doit pas déconnecter.
      if (erreur instanceof ErreurGitHub && CODES_JETON_PERDU.includes(erreur.code)) {
        effacerJeton();
      }
      afficherConnexion(messageErreur(erreur));
    }
  };

  function formulaireConnexion(erreur?: string): HTMLElement {
    const formulaire = element('form', 'admin-connexion');
    formulaire.noValidate = true;
    formulaire.append(element('p', undefined, t('admin.intro')));

    const etiquette = element('label', 'champ');
    etiquette.append(element('span', undefined, t('admin.jeton')));
    const saisie = element('input');
    saisie.type = 'password';
    saisie.autocomplete = 'off';
    saisie.spellcheck = false;
    saisie.required = true;
    saisie.setAttribute('autocapitalize', 'off');
    etiquette.append(saisie);

    const rester = element('label', 'champ-case');
    const caseRester = element('input');
    caseRester.type = 'checkbox';
    caseRester.checked = jetonSurAppareil();
    rester.append(caseRester, element('span', undefined, t('admin.rester')));

    const message = element('p', 'erreur-champ');
    message.setAttribute('role', 'alert');
    message.textContent = erreur ?? '';
    if (erreur !== undefined) saisie.setAttribute('aria-invalid', 'true');

    const valider = element('button', 'bouton bouton-principal', t('admin.connexion'));
    valider.type = 'submit';
    formulaire.append(etiquette, rester, valider, message);

    formulaire.addEventListener('submit', (evenement) => {
      evenement.preventDefault();
      const jeton = nettoyerJeton(saisie.value);
      if (jeton === undefined) {
        saisie.setAttribute('aria-invalid', 'true');
        message.textContent = t('admin.erreur.jeton_vide');
        saisie.focus();
        return;
      }
      valider.disabled = true;
      void connecter(jeton, caseRester.checked, true).finally(() => {
        valider.disabled = false;
      });
    });
    return formulaire;
  }

  const jetonMemorise = lireJeton();
  if (jetonMemorise === undefined) afficherConnexion();
  else void connecter(jetonMemorise, jetonSurAppareil(), false);
  return racine;
}

function panneauSession(
  client: ClientGitHub,
  utilisateur: Utilisateur,
  deconnecter: () => void,
): HTMLElement {
  const panneau = element('div', 'admin-session');
  const statut = element('p', undefined, tv('admin.connecte', { nom: utilisateur.login }));
  const droit = element('p', 'carte-meta', t('admin.droit_ok'));

  const titreDeploiement = element('h2', undefined, t('admin.deploiement'));
  const etatDeploiement = element('p', 'admin-deploiement');
  etatDeploiement.setAttribute('role', 'status');
  const lien = element('a', undefined, t('admin.deploiement.voir'));
  lien.rel = 'noopener';
  lien.hidden = true;

  const actualiser = element('button', 'bouton', t('admin.actualiser'));
  actualiser.type = 'button';

  const afficherDeploiement = (deploiement: Deploiement | undefined): void => {
    if (deploiement === undefined) {
      etatDeploiement.textContent = t('admin.deploiement.aucun');
      lien.hidden = true;
      return;
    }
    const cle: Record<Deploiement['etat'], CleI18n> = {
      en_cours: 'admin.deploiement.en_cours',
      termine: 'admin.deploiement.termine',
      echec: 'admin.deploiement.echec',
    };
    const date = new Intl.DateTimeFormat(document.documentElement.lang, {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(deploiement.date));
    etatDeploiement.textContent = `${t(cle[deploiement.etat])} · ${date} · ${deploiement.commit.slice(0, 7)}`;
    lien.href = deploiement.url;
    lien.hidden = false;
  };

  const chargerDeploiement = async (): Promise<void> => {
    actualiser.disabled = true;
    try {
      afficherDeploiement(await client.dernierDeploiement());
    } catch (erreur) {
      etatDeploiement.textContent = messageErreur(erreur);
      lien.hidden = true;
    } finally {
      actualiser.disabled = false;
    }
  };

  actualiser.addEventListener('click', () => void chargerDeploiement());

  const sortie = element('button', 'bouton', t('admin.deconnexion'));
  sortie.type = 'button';
  sortie.addEventListener('click', () => {
    deconnecter();
    annoncer(t('admin.deconnexion'));
  });

  panneau.append(statut, droit, titreDeploiement, etatDeploiement, lien, actualiser, sortie);
  void chargerDeploiement();
  return panneau;
}
