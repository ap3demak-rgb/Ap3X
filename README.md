# AP3X Records

Static music listening site (SoundCloud style) for the AP3X Records catalogue, built with TypeScript, Vite and Three.js, hosted on GitHub Pages.

- Official website: https://github.com/ap3demak-rgb/Ap3X
- Contact: ap3x.records@proton.me

## Requirements

- Node.js 20 or later
- npm

## Installation

```
npm install
```

## npm scripts

| Command                 | Description                                                                           |
| ----------------------- | ------------------------------------------------------------------------------------- |
| `npm run dev`           | Start the Vite development server                                                     |
| `npm run build`         | Type-check, then build the site into `dist/`                                          |
| `npm run preview`       | Serve the production build locally                                                    |
| `npm run typecheck`     | Run the TypeScript compiler without emitting                                          |
| `npm run lint`          | Run ESLint                                                                            |
| `npm run format`        | Format the project with Prettier                                                      |
| `npm run icones`        | Regenerate PNG/ICO icons from `public/icones/favicon.svg`                             |
| `npm run tags-id3`      | Write copyright and official URLs into the ID3 tags of every MP3 in `public/musique/` |
| `npm run verifier`      | Run the SPDX, i18n and forbidden-mention checks                                       |
| `npm run verifier:docs` | Check that documentation is consistent with staged changes                            |

## Project structure

- `src/`: TypeScript source code
- `src/styles/`: CSS (single dark theme)
- `scripts/`: build-time scripts (catalogue generation)
- `src/i18n/`: translation files (en, fr, de, ja, es, ru, vi, zh, ko), accessed through `t('key')`
- `public/icones/`: favicon and app icons
- `public/musique/`: MP3 files, one subfolder per category
- `.github/workflows/`: continuous integration (checks, lint, type-check, build)
- `.husky/`: git hooks (checks before commit, commit message validation)

## Contribution checks

Every source file carries an SPDX header (`GPL-3.0-or-later`). `npm run build` and the `pre-commit` hook run the license, i18n and forbidden-mention checks. Any change to the sources must come with an entry in `CHANGELOG.md`.

## Licenses

- Website source code (see `LICENSE` and `COPYING`): GNU General Public License v3.0 or later (GPL-3.0-or-later).
- Music: Creative Commons CC BY-NC-ND 4.0.

© 2026 AP3X Records
