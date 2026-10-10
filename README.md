# AP3X Records

Static music listening site (SoundCloud style) for the AP3X Records catalogue, built with TypeScript, Vite and Three.js, hosted on GitHub Pages.

- Official website: https://github.com/ap3demak-rgb/Ap3X
- Contact: ap3x.records@proton.me

## Administration page

`#/admin` (for example <https://ap3demak-rgb.github.io/Ap3X/#/admin>) is not linked from the public site and asks search engines not to index it. It runs entirely in your browser and talks to the GitHub API with a personal token; nothing goes through another server.

Create the token on GitHub: **Settings, Developer settings, Personal access tokens, Fine-grained tokens, Generate new token**. Choose a short expiration, set **Only select repositories** to `ap3demak-rgb/Ap3X`, and grant a single repository permission: **Contents: Read and write** (Metadata read-only is added automatically; add **Actions: Read** to see the deployment status). Paste the token on the sign-in screen. It stays in the tab (`sessionStorage`) unless you tick "Stay signed in on this device" (`localStorage`); "Sign out" erases it. To revoke it, delete the token in the same GitHub settings page. Never put a token in the code, the repository or an issue.

**Adding a track.** Open **New track**, drop an MP3 file (or choose it): the title, artist, date, comment and genre found in its ID3 tags fill the empty fields. Pick or create a category (a new category creates its folder), add hashtags, an optional cover image (resized and converted to WebP in your browser) and choose whether to publish immediately or keep a draft (`"visible": false` in the sheet, hidden from the public catalogue). **Save the track** sends the MP3, its JSON sheet and the cover in one commit to `public/musique/<category>/`; the deployment workflow then rebuilds the site (follow it in **Overview**). The file name and the track identifier come from the title; a title already used in the category is refused. A file larger than 100 MB is refused (GitHub limit). **Tracks** lists everything in the repository, drafts included, with search, category and hashtag filters. Each track has **Edit** (all fields, a new MP3, a new cover, another category, publishing a draft) and **Delete** (after confirmation: the MP3, the sheet and the cover are removed in one commit; the GitHub history keeps a copy). Moving a track to another category moves its files without uploading them again and is refused if the identifier would clash. Select several tracks to move them, add a hashtag, hide or publish them, or delete them in one commit; if one of the selected tracks cannot be processed, nothing is changed. **Preview the public page** shows what visitors will see before anything is published. Tracks that belong to an album keep the category of the album and cannot be deleted one by one.

**Albums.** **New album** takes several MP3 files at once (choose them or drop them): they are sorted by the disc and track numbers of their tags, the tags fill the empty album fields and the first embedded picture can serve as the cover. Edit the title, artist and disc of each track, reorder them with the arrow buttons or by dragging, add a track already published as a single, remove tracks, and check the suggested type (single, EP, LP) and the total duration; **Preview the public page** shows the result. A published album needs a cover; a draft does not. **Albums** lists every album (drafts and uploads that were interrupted are flagged) with search and type, category and year filters. **Edit** changes the metadata, the cover, the order and the tracks; a track removed from an album becomes a single track of its category again (with the album cover if it has none); changing the category moves the whole album without uploading its files again. **Delete** asks whether to keep the tracks as single tracks or to delete them with the album. An upload larger than about 25 MB is split into several commits: the first one creates the folder with a hidden album, the next ones send the MP3 files by batches, the last one makes the album visible; the site is never left in a state that fails to build. If the connection drops, the form is locked and **Resume the upload** sends only what is missing (the page must stay open). Each commit starts a deployment, so a large album triggers several short deployments in a row.

**Categories.** **Categories** lists them in the order the site uses. **New category** creates a folder (named after the name, without accents or spaces) with its `categorie.json` and an optional cover; a category appears on the site as soon as it exists, even without tracks. **Edit** changes the displayed name, the description, the color and the cover; the folder never changes, so track addresses and shared links stay valid. The color must reach a contrast of at least 3:1 with the site backgrounds (shown while you type). The arrows reorder the list and **Save the order** writes an `ordre` number in each `categorie.json` (categories without one come last, by name). **Delete** removes an empty category after confirmation; if it contains tracks or albums you choose another category that receives them (their files are moved without being uploaded again, and the move is refused if a file or an identifier already exists there).

Deployment

Every push to `main` runs `.github/workflows/deploy.yml`: dependencies, catalogue generation, build, performance budget, then publication with `actions/deploy-pages`. In the repository settings, GitHub Pages must use the source **GitHub Actions**. The site is served at <https://ap3demak-rgb.github.io/Ap3X/>; Vite `base` is `/Ap3X/` (`src/constantes.ts`). GitHub limits: files under 100 MB, repository ideally under 1 GB, published site under 1 GB. Git LFS is not needed while the music library stays well below 1 GB; beyond roughly 500 MB, prefer external storage.

## Offline and performance

The production build registers a service worker (`src/sw/`) that caches the interface, covers and catalogue so the site opens offline; audio files are never cached. Card lists show 48 items at a time. The startup script stays under a gzip budget checked by `npm run verifier:budget`.

## Requirements

- Node.js 20 or later
- npm

## Installation

```
npm install
```

## npm scripts

| Command                   | Description                                                                                                                                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `npm run dev`             | Start the Vite development server                                                                                                                                                                      |
| `npm run build`           | Type-check, then build the site into `dist/`                                                                                                                                                           |
| `npm run preview`         | Serve the production build locally                                                                                                                                                                     |
| `npm run typecheck`       | Run the TypeScript compiler without emitting                                                                                                                                                           |
| `npm run lint`            | Run ESLint                                                                                                                                                                                             |
| `npm run format`          | Format the project with Prettier                                                                                                                                                                       |
| `npm run format:verifier` | Check formatting with Prettier without changing files (run by the `pre-commit` hook and the CI workflow)                                                                                               |
| `npm run icones`          | Regenerate PNG/ICO icons from `public/icones/favicon.svg`                                                                                                                                              |
| `npm test`                | Run the unit tests (Vitest); `npx vitest run tests/lecteur.test.ts` runs a single file                                                                                                                 |
| `npm run e2e`             | Build first (`npm run build`), then run the Playwright end-to-end and axe accessibility tests; the first time, run `npx playwright install chromium firefox webkit`                                    |
| `npm run catalogue`       | Generate `public/catalogue.json` from `public/musique/` (runs automatically before `dev` and `build`)                                                                                                  |
| `npm run verifier:budget` | After `npm run build`: check the performance budget (gzip size of the startup script, deferred chunks and styles, size of generated covers, no original image left in `dist/`)                         |
| `npm run lighthouse`      | After `npm run build`: Lighthouse audit (mobile and desktop) of the home, albums and licenses pages, served like GitHub Pages; fails below 90 (accessibility, best practices, SEO) or 80 (performance) |
| `npm run tags-id3`        | Write copyright and official URLs into the ID3 tags of every MP3 in `public/musique/`                                                                                                                  |
| `npm run verifier`        | Run the SPDX, i18n and forbidden-mention checks                                                                                                                                                        |
| `npm run verifier:docs`   | Check that documentation is consistent with staged changes                                                                                                                                             |

## Project structure

- `src/`: TypeScript source code
- `src/catalogue/`: catalogue schemas (shared with the generator) and client-side loading
- `src/lecteur/`: audio player (queue logic, fixed player bar, Media Session, keyboard shortcuts)
- `src/styles/`: CSS (single dark theme)
- `scripts/`: build-time scripts (catalogue generation, checks)
- `tests/`: unit tests (Vitest)
- `e2e/`: end-to-end and accessibility tests (Playwright, axe-core)
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
- Covers are converted at build time (`npm run catalogue`): a large WebP (up to 960 px) for detail pages and the 3D cover, a small WebP (320 px) for cards and the player bar, and a 1200 px JPEG for link previews, all in `public/pochettes/` (generated, git-ignored, named after the content hash so unchanged covers are not redone). The original images are removed from `dist/` after the build.
- A file named `cover.png`, `cover.jpg`, `cover.webp` (or `pochette.*`) in a category or album folder is used as its cover. Covers embedded in MP3 files are extracted to `public/pochettes/`.
- Hashtags come from the sheet and from `#words` in the description.
- Downloads are opt-in: `"telechargement": true` in a track sheet shows a "Download MP3" link on its page; the same field in `album.json` shows "Download album (ZIP)", an archive built in the browser (tracks, cover, and a `LICENSE.txt` with the attribution) without compression, since MP3 files are already compressed.
- A track belongs to the category of its folder and can join others: list them in its sheet (`"categories": ["techno"]`, by name or identifier) or give it an ID3 genre that matches an existing category. An unknown category in a sheet is reported; an unknown genre is ignored.
- The category names `tout` and `favoris` are reserved for the "All" and "Favorites" pages.

## Pages

Home (latest tracks and albums, categories, popular hashtags cloud), categories (`#/categories`, `#/categorie/<slug>`: albums then standalone tracks, "Play all", sort by newest, oldest, title, duration or artist; `tout` lists everything and `favoris` the tracks you liked, stored in the browser), hashtag pages (`#/tag/<name>`), a category filter in the navigation bar, albums grid with filters (type, category, year) and sort, album page (`#/album/<id>`, tracks grouped by disc, total duration, license), track page (`#/piste/<id>`, large waveform, similar tracks, download if allowed) and licenses. Every track has a waveform (200 bars computed at build time from the MP3 and cached in `.cache/`) that can be clicked or driven with the keyboard to seek.

## 3D rendering

Three.js is loaded on demand after the interface is shown (`src/rendu3d/`). One shared WebGL renderer draws an animated GLSL background on a full-screen canvas behind the page, and renders small "windows" (the audio visualizer band under the header and the 3D cover on a track page) before copying each image into a 2D canvas placed in the page. The visualizer shows the active track waveform and a real-time spectrum from a Web Audio `AnalyserNode`.

Text never sits directly on the 3D render: it rests on a semi-opaque panel, and the background shader is clamped to `--fond-3d-max`, so `npm run verifier:contrastes` can guarantee AAA contrast in the worst case. With `prefers-reduced-motion` there is no 3D at all (static gradient, flat cover, no visualizer); without WebGL (or if the context is lost) the visualizer becomes a CSS level bar and covers stay flat. Rendering pauses while the tab is hidden, windows pause when off screen, the pixel ratio is capped at 1.5 and touch devices are limited to 30 frames per second.

## Sharing and SEO

- **Copy link** on every track and album page. In production the link points to a small static page generated at build time (`partage/piste/<id>/`, `partage/album/<id>/`) that carries the Open Graph and Twitter Card tags (title, description, cover) and then redirects to the application: crawlers do not read hash routes or run JavaScript, so this is what makes link previews work. On a track, "Start at 1:30" adds the current playback position (`?t=1m30s`).
- **Opening a shared link starts playback** when the site is opened on a track page, or when a link with `?t=` is pasted in an open tab. Browsing the site, or changing the language, never starts playback. If the browser blocks autoplay, the track is loaded at the requested position and a message asks to press Play. Accepted instants: `90`, `90s`, `1m30s`, `1h2m3s`, `1:30`, `1:02:03`.
- `npm run build` also writes `404.html` (immediate redirect to the home page), `sitemap.xml` and `robots.txt` into `dist/` (`scripts/generer-pages-statiques.ts`). The public address used in these files and in the home page tags is `URL_SITE` in `src/constantes.ts`, overridable with the `SITE_URL` environment variable (custom domain). `robots.txt` is only honored by crawlers at the root of a domain.

## Search, favorites and playlists

- **Search** (header, `role="search"`): results appear as you type, grouped by tracks, albums, artists, hashtags and categories. It ignores case and accents in both the query and the titles, and every word must match (title, artist, hashtags, album, category, description, catalogue reference). Arrow keys move through the results, `Escape` closes the panel, `Enter` opens the full results page (`#/recherche/<query>`). Artist names link to an artist page (`#/artiste/<name>`).
- **Favorites**: a heart button on tracks and albums (outlined or filled, with a changing label). They are stored in the browser and listed, with their albums, on the Favorites page (`#/categorie/favoris`, also in the navigation bar).
- **Queue**: "Add to queue" on tracks and albums (a whole album at once); the addition is announced to screen readers.
- **Playlists** (`#/playlists`, `#/playlist/<id>`): create from the Playlists page or from the "Add to a playlist" button on any track or album, rename, delete (with confirmation), reorder (move up / down), remove tracks and play. Playlists are stored in the browser; **export** downloads them as `playlists-ap3x.json` and **import** adds the playlists of such a file without ever overwriting an existing one (duplicate names get a suffix). Names are limited to 80 characters.

## Player

A fixed bar at the bottom of every page plays the queue: play/pause, previous/next, seek bar, volume and mute, shuffle, repeat (off / queue / track) and a queue panel (reorder, remove). The next track is preloaded, hardware media keys and mobile lock screens are supported (Media Session API), and the volume, shuffle, repeat mode and last played track are remembered in the browser.

Keyboard shortcuts (when no form control has the focus): `Space` play/pause, `←` / `→` seek by 5 seconds, `M` mute.

## Contribution checks

The palette in `src/styles/theme.css` is checked against WCAG 2.2 AAA contrast ratios by `npm run verifier:contrastes`. Every source file carries an SPDX header (`GPL-3.0-or-later`). `npm run build` and the `pre-commit` hook run the license, i18n and forbidden-mention checks. Any change to the sources must come with an entry in `CHANGELOG.md`.

## Licenses

- Website source code (see `LICENSE` and `COPYING`): GNU General Public License v3.0 or later (GPL-3.0-or-later).
- Music: Creative Commons CC BY-NC-ND 4.0.

© 2026 AP3X Records
