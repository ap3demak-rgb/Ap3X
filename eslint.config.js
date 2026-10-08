// SPDX-License-Identifier: GPL-3.0-or-later
// © 2026 AP3X Records

import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['dist/', 'node_modules/', 'public/'] },
  js.configs.recommended,
  ...tseslint.configs.strict,
);
