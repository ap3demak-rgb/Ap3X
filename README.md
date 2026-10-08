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

| Command             | Description                                   |
| ------------------- | --------------------------------------------- |
| `npm run dev`       | Start the Vite development server             |
| `npm run build`     | Type-check, then build the site into `dist/`  |
| `npm run preview`   | Serve the production build locally            |
| `npm run typecheck` | Run the TypeScript compiler without emitting  |
| `npm run lint`      | Run ESLint                                    |
| `npm run format`    | Format the project with Prettier              |

## Project structure

- `src/`: TypeScript source code
- `src/styles/`: CSS (single dark theme)
- `scripts/`: build-time scripts (catalogue generation)
- `public/musique/`: MP3 files, one subfolder per category

## Licenses

- Website source code: GNU General Public License v3.0 or later (GPL-3.0-or-later).
- Music: Creative Commons CC BY-NC-ND 4.0.

© 2026 AP3X Records
