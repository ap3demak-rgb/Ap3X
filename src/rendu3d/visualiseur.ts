// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  Group,
  InstancedMesh,
  MathUtils,
  MeshLambertMaterial,
  Object3D,
  PerspectiveCamera,
  Scene,
} from 'three';
import { NOMBRE_BANDES } from './analyseur';
import { jetonCouleur } from './couleurs';
import type { SourcesVue, VueFenetre } from './vue';

const NOMBRE_PICS = 200;
const DISTANCE_CAMERA = 6;
const CHAMP_VISION = 40;

/**
 * Visualiseur : la waveform de la piste active (partie lue plus claire, trait à la position courante)
 * et, en dessous, le spectre en temps réel. Décoratif : l'information est portée par le lecteur.
 */
export function creerVisualiseur(sources: SourcesVue): VueFenetre {
  const scene = new Scene();
  scene.background = new Color(jetonCouleur('--fond'));
  const camera = new PerspectiveCamera(CHAMP_VISION, 1, 0.1, 50);
  camera.position.set(0, 0, DISTANCE_CAMERA);

  scene.add(new AmbientLight(0xffffff, 1.6));
  const lumiere = new DirectionalLight(0xffffff, 2);
  lumiere.position.set(2, 3, 5);
  scene.add(lumiere);

  const geometrie = new BoxGeometry(1, 1, 1);
  const materiauOnde = new MeshLambertMaterial({ color: 0xffffff });
  const materiauSpectre = new MeshLambertMaterial({ color: jetonCouleur('--accent') });
  const onde = new InstancedMesh(geometrie, materiauOnde, NOMBRE_PICS);
  const spectre = new InstancedMesh(geometrie, materiauSpectre, NOMBRE_BANDES);
  const groupe = new Group();
  groupe.add(onde, spectre);
  scene.add(groupe);

  const couleurLue = new Color(jetonCouleur('--onde-lue'));
  const couleurNonLue = new Color(jetonCouleur('--onde'));
  const couleurTrait = new Color(jetonCouleur('--texte'));
  const factice = new Object3D();

  let largeurVisible = 6;
  let hauteurVisible = 3;

  function redimensionner(largeur: number, hauteur: number): void {
    camera.aspect = largeur / Math.max(1, hauteur);
    camera.updateProjectionMatrix();
    hauteurVisible = 2 * Math.tan(MathUtils.degToRad(CHAMP_VISION / 2)) * DISTANCE_CAMERA;
    largeurVisible = hauteurVisible * camera.aspect;
  }

  function mettreAJour(secondes: number): void {
    const { pics, progression } = sources.piste();
    // Marge large : l'inclinaison et la perspective agrandissent légèrement les barres les plus proches.
    const zone = largeurVisible * 0.84;
    const pasOnde = zone / NOMBRE_PICS;
    const indexTrait = Math.min(NOMBRE_PICS - 1, Math.floor(progression * NOMBRE_PICS));

    for (let i = 0; i < NOMBRE_PICS; i += 1) {
      const pic = pics.length > 0 ? (pics[Math.floor((i / NOMBRE_PICS) * pics.length)] ?? 0) : 4;
      const hauteur = Math.max(hauteurVisible * 0.02, (pic / 100) * hauteurVisible * 0.4);
      factice.position.set(-zone / 2 + (i + 0.5) * pasOnde, hauteurVisible * 0.2, 0);
      factice.scale.set(pasOnde * 0.7, hauteur, pasOnde * 2);
      factice.updateMatrix();
      onde.setMatrixAt(i, factice.matrix);
      const lue = progression > 0 && i <= indexTrait;
      onde.setColorAt(
        i,
        progression > 0 && i === indexTrait ? couleurTrait : lue ? couleurLue : couleurNonLue,
      );
    }
    onde.instanceMatrix.needsUpdate = true;
    if (onde.instanceColor !== null) onde.instanceColor.needsUpdate = true;

    const pasSpectre = zone / NOMBRE_BANDES;
    for (let i = 0; i < NOMBRE_BANDES; i += 1) {
      // Gain modéré : les valeurs lissées de l'analyseur dépassent rarement 0,6 sur de la musique.
      const valeur = Math.min(1, (sources.spectre[i] ?? 0) * 1.5);
      const hauteur = Math.max(hauteurVisible * 0.02, valeur * hauteurVisible * 0.28);
      factice.position.set(
        -zone / 2 + (i + 0.5) * pasSpectre,
        -hauteurVisible * 0.36 + hauteur / 2,
        0,
      );
      factice.scale.set(pasSpectre * 0.7, hauteur, pasSpectre * 2);
      factice.updateMatrix();
      spectre.setMatrixAt(i, factice.matrix);
    }
    spectre.instanceMatrix.needsUpdate = true;

    // Légère inclinaison lente : donne du volume sans mouvement brusque.
    groupe.rotation.x = -0.28 + Math.sin(secondes * 0.4) * 0.03;
    groupe.rotation.y = Math.sin(secondes * 0.25) * 0.06;
  }

  redimensionner(1, 1);
  return {
    scene,
    camera,
    redimensionner,
    mettreAJour,
    dispose: () => {
      scene.remove(groupe);
      onde.dispose();
      spectre.dispose();
      geometrie.dispose();
      materiauOnde.dispose();
      materiauSpectre.dispose();
    },
  };
}
