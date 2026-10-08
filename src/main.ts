// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

const racine = document.getElementById('app');
if (racine === null) {
  throw new Error('Élément #app introuvable');
}
racine.textContent = 'AP3X Records';
