// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import {
  Mesh,
  OrthographicCamera,
  PlaneGeometry,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
} from 'three';
import { jetonSrgb } from './couleurs';
import fragment from './fond.frag?raw';
import vertex from './fond.vert?raw';

/** Fond animé plein écran (shader GLSL), toujours compris entre la couleur de page et le maximum du thème. */
export class Fond {
  readonly scene = new Scene();
  readonly camera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  private readonly materiau: ShaderMaterial;
  private readonly geometrie = new PlaneGeometry(2, 2);
  private readonly maillage: Mesh;

  constructor() {
    this.materiau = new ShaderMaterial({
      vertexShader: vertex,
      fragmentShader: fragment,
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTemps: { value: 0 },
        uResolution: { value: new Vector2(1, 1) },
        uFond: { value: new Vector3(...jetonSrgb('--fond')) },
        uMax: { value: new Vector3(...jetonSrgb('--fond-3d-max')) },
        uNiveau: { value: 0 },
      },
    });
    this.maillage = new Mesh(this.geometrie, this.materiau);
    this.maillage.frustumCulled = false;
    this.scene.add(this.maillage);
  }

  redimensionner(largeur: number, hauteur: number): void {
    (this.materiau.uniforms['uResolution']?.value as Vector2).set(largeur, hauteur);
  }

  mettreAJour(secondes: number, niveau: number): void {
    const uniformes = this.materiau.uniforms;
    if (uniformes['uTemps'] !== undefined) uniformes['uTemps'].value = secondes;
    if (uniformes['uNiveau'] !== undefined) uniformes['uNiveau'].value = niveau;
  }

  dispose(): void {
    this.scene.remove(this.maillage);
    this.geometrie.dispose();
    this.materiau.dispose();
  }
}
