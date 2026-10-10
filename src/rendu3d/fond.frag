// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

precision highp float;

uniform float uTemps;
uniform vec2 uResolution;
// Couleur de la page et couleur maximale autorisée : la sortie reste toujours entre les deux, ce qui
// garantit le contraste AAA du texte posé sur le panneau semi-opaque au-dessus du fond.
uniform vec3 uFond;
uniform vec3 uMax;
uniform float uNiveau;
// De 0 à 1 : part de la couleur maximale utilisée (réglage du site) ; la sortie reste entre uFond et uMax.
uniform float uIntensite;

varying vec2 vUv;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}

float bruit(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(
    mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
    mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
    f.y
  );
}

float fbm(vec2 p) {
  float valeur = 0.0;
  float amplitude = 0.5;
  for (int i = 0; i < 4; i++) {
    valeur += amplitude * bruit(p);
    p *= 2.0;
    amplitude *= 0.5;
  }
  return valeur;
}

void main() {
  vec2 uv = vUv * vec2(uResolution.x / uResolution.y, 1.0);
  // Mouvement très lent : aucune variation rapide, donc aucun risque de clignotement.
  float t = uTemps * 0.02;
  float n = fbm(uv * 2.2 + vec2(t, -0.7 * t) + fbm(uv * 3.0 - t));
  float intensite = smoothstep(0.3, 0.9, n) * (0.7 + 0.3 * uNiveau) * uIntensite;
  vec3 couleur = mix(uFond, uMax, intensite);
  gl_FragColor = vec4(clamp(couleur, min(uFond, uMax), max(uFond, uMax)), 1.0);
}
