// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  AmbientLight,
  BoxGeometry,
  Color,
  DirectionalLight,
  MathUtils,
  Mesh,
  MeshLambertMaterial,
  PerspectiveCamera,
  Scene,
  SRGBColorSpace,
  Texture,
  TextureLoader,
} from 'three';
import { jetonCouleur } from './couleurs';
import type { VueFenetre } from './vue';

/** Pochette en 3D : plaque texturée avec un léger balancement, qui suit doucement le pointeur. */
export function creerPochette3d(url: string): Promise<VueFenetre> {
  return new Promise((resoudre, rejeter) => {
    new TextureLoader().load(
      url,
      (texture) => resoudre(construire(texture)),
      undefined,
      () => rejeter(new Error(`Pochette illisible : ${url}`)),
    );
  });
}

function construire(texture: Texture): VueFenetre {
  texture.colorSpace = SRGBColorSpace;
  const scene = new Scene();
  scene.background = new Color(jetonCouleur('--fond'));
  const camera = new PerspectiveCamera(35, 1, 0.1, 50);
  camera.position.set(0, 0, 4.2);

  scene.add(new AmbientLight(0xffffff, 2.2));
  const lumiere = new DirectionalLight(0xffffff, 1.2);
  lumiere.position.set(2, 2, 4);
  scene.add(lumiere);

  const geometrie = new BoxGeometry(2, 2, 0.12);
  const tranche = new MeshLambertMaterial({ color: jetonCouleur('--surface') });
  const face = new MeshLambertMaterial({ map: texture });
  // Ordre des faces d'un BoxGeometry : +x, -x, +y, -y, +z (avant), -z.
  const plaque = new Mesh(geometrie, [tranche, tranche, tranche, tranche, face, tranche]);
  scene.add(plaque);

  let cibleX = 0;
  let cibleY = 0;
  let pointeurActif = false;

  return {
    scene,
    camera,
    redimensionner: (largeur, hauteur) => {
      camera.aspect = largeur / Math.max(1, hauteur);
      camera.updateProjectionMatrix();
    },
    mettreAJour: (secondes, delta) => {
      const reposY = Math.sin(secondes * 0.6) * 0.22;
      const reposX = Math.sin(secondes * 0.45) * 0.08;
      const visee = pointeurActif ? { x: cibleX, y: cibleY } : { x: reposX, y: reposY };
      const lissage = 1 - Math.exp(-4 * delta);
      plaque.rotation.x = MathUtils.lerp(plaque.rotation.x, visee.x, lissage);
      plaque.rotation.y = MathUtils.lerp(plaque.rotation.y, visee.y, lissage);
    },
    pointeur: (x, y) => {
      pointeurActif = Number.isFinite(x) && Number.isFinite(y);
      cibleY = x * 0.5;
      cibleX = -y * 0.35;
    },
    dispose: () => {
      scene.remove(plaque);
      geometrie.dispose();
      tranche.dispose();
      face.dispose();
      texture.dispose();
    },
  };
}
