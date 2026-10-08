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

| Command                 | Description                                                                                           |
| ----------------------- | ----------------------------------------------------------------------------------------------------- |
| `npm run dev`           | Start the Vite development server                                                                     |
| `npm run build`         | Type-check, then build the site into `dist/`                                                          |
| `npm run preview`       | Serve the production build locally                                                                    |
| `npm run typecheck`     | Run the TypeScript compiler without emitting                                                          |
| `npm run lint`          | Run ESLint                                                                                            |
| `npm run format`        | Format the project with Prettier                                                                      |
| `npm run icones`        | Regenerate PNG/ICO icons from `public/icones/favicon.svg`                                             |
| `npm test`              | Run the unit tests (Vitest); `npx vitest run tests/lecteur.test.ts` runs a single file                |
| `npm run catalogue`     | Generate `public/catalogue.json` from `public/musique/` (runs automatically before `dev` and `build`) |
| `npm run tags-id3`      | Write copyright and official URLs into the ID3 tags of every MP3 in `public/musique/`                 |
| `npm run verifier`      | Run the SPDX, i18n and forbidden-mention checks                                                       |
| `npm run verifier:docs` | Check that documentation is consistent with staged changes                                            |

## Project structure

- `src/`: TypeScript source code
- `src/catalogue/`: catalogue schemas (shared with the generator) and client-side loading
- `src/lecteur/`: audio player (queue logic, fixed player bar, Media Session, keyboard shortcuts)
- `src/styles/`: CSS (single dark theme)
- `scripts/`: build-time scripts (catalogue generation, checks)
- `tests/`: unit tests (Vitest)
- `src/i18n/`: translation files (en, fr, de, ja, es, ru, vi, zh, ko), accessed through `t('key')`
- `public/icones/`: favicon and app icons
- `public/musique/`: MP3 files, one subfolder per category
- `.github/workflows/`: continuous integration (checks, lint, type-check, build)
- `.husky/`: git hooks (checks before commit, commit message validation)

## Music library

Put MP3 files in `public/musique/`: **one subfolder = one category** (`public/musique/<category>/<title>.mp3`). `npm run catalogue` scans it and writes `public/catalogue.json`; the build fails on any invalid sheet.

- `categorie.json` (optional, in a category folder): `nom`, `description`, `couleur` (`#RRGGBB`), `pochette`.
- `title.json` (optional, next to `title.mp3`): `titre`, `artiste`, `description`, `hashtags`, `pochette`, `date`, `visible`, `telechargement`, `licence`, `copyright`. Values here take priority over ID3 tags, which are used as defaults.
- Album: a subfolder of a category with an `album.json` (`titre` and the ordered list `pistes`, each a file name or `{ "fichier": "x.mp3", "disque": 2 }`; optional `artiste`, `type` = single / ep / lp / compilation, `date`, `description`, `pochette`, `hashtags`, `licence`, `copyright`, `reference`, `visible`). Without `type`: 1 track = single, 2 to 6 = ep, 7 or more = lp.
- A file named `cover.png`, `cover.jpg`, `cover.webp` (or `pochette.*`) in a category or album folder is used as its cover. Covers embedded in MP3 files are extracted to `public/pochettes/`.
- Hashtags come from the sheet and from `#words` in the description.

## Player

A fixed bar at the bottom of every page plays the queue: play/pause, previous/next, seek bar, volume and mute, shuffle, repeat (off / queue / track) and a queue panel (reorder, remove). The next track is preloaded, hardware media keys and mobile lock screens are supported (Media Session API), and the volume, shuffle, repeat mode and last played track are remembered in the browser.

Keyboard shortcuts (when no form control has the focus): `Space` play/pause, `←` / `→` seek by 5 seconds, `M` mute.

## Contribution checks

Every source file carries an SPDX header (`GPL-3.0-or-later`). `npm run build` and the `pre-commit` hook run the license, i18n and forbidden-mention checks. Any change to the sources must come with an entry in `CHANGELOG.md`.

## Licenses

- Website source code (see `LICENSE` and `COPYING`): GNU General Public License v3.0 or later (GPL-3.0-or-later).
- Music: Creative Commons CC BY-NC-ND 4.0.

© 2026 AP3X Records
