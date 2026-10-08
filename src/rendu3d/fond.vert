// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

varying vec2 vUv;

void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
