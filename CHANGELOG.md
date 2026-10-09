# Changelog

All notable changes to this project are documented in this file.
The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Added

- 2026-10-08: Project initialization (Phase 0): git repository, `package.json`, Vite, TypeScript (strict), ESLint, Prettier, Three.js, base folder structure, `README.md`.
- 2026-10-08: Licensing and identity (Phase 0b): `LICENSE`, `COPYING`, `REUSE.toml`, SPDX headers, favicon and app icons, web manifest, `.gitattributes`.
- 2026-10-08: Internationalization base: nine language files, typed `t()` function, browser language detection with stored choice and English fallback.
- 2026-10-08: Quality checks: license, i18n, forbidden-mention and documentation scripts, plus Husky `pre-commit` and `commit-msg` hooks.
- 2026-10-08: Site shell: header with logo, navigation and language selector, footer with copyright, both license notices and contact, hash router and `#/licences` page.
- 2026-10-08: `Intl` helpers (plural, date, duration), font stacks for Latin, Cyrillic, Chinese, Japanese and Korean, skip-to-content button.
- 2026-10-08: `npm run tags-id3` script and continuous integration workflow; checks against contributor lists and the package author.
- 2026-10-08: Catalogue (Phase 1): shared Zod schemas, `scripts/generer-catalogue.ts` producing `public/catalogue.json` (categories, tracks, albums, hashtag index, durations, covers), run before `dev` and `build`; client-side loading and validation of the catalogue.
- 2026-10-09: Audio player (Phase 2): `Lecteur` class (queue, shuffle, repeat, volume, preloading, remembered settings), fixed player bar with seek, volume, queue panel and screen-reader announcements, Media Session integration, keyboard shortcuts, track list on the home page.
- 2026-10-09: Vitest unit tests for the player and the catalogue helpers, run by `npm test` and the CI workflow.
- 2026-10-09: Placeholder check is now case-sensitive and word-based, so common words such as the Spanish "todo" no longer fail it.
- 2026-10-09: Interface (Phase 3, part 1): single dark theme with an AAA palette checked by `scripts/verifier-contrastes.ts`, cards, home page, albums page with filters, album page, track page, waveform computed at build time and rendered on canvas with a native seek slider, hash router with focus handling, reduced-motion support.
- 2026-10-09: Playwright end-to-end tests with axe-core (WCAG AAA rules) run in the CI workflow; routing, data helpers and translation variables are covered by unit tests.
- 2026-10-09: Three.js rendering (Phase 3, part 2): shared WebGL renderer, animated GLSL background clamped to the theme maximum, 3D audio visualizer (waveform and Web Audio spectrum), 3D cover on the track page, reduced-motion and no-WebGL fallbacks, resource disposal; the palette check now covers the worst case of the semi-opaque content panel over the animated background.
- 2026-10-09: Page title and language change announced to screen readers; end-to-end tests for 3D, reduced motion, no WebGL, 200 % text size and announcements.
- 2026-10-09: Categories and hashtags (Phase 4): categories page and category pages (albums, then tracks outside albums, "Play all", five sort orders), "All" and "Favorites" pages, hashtag pages, popular hashtags cloud, clickable hashtags on cards and detail pages, category filter in the navigation bar, tracks in several categories (sheet field `categories` or ID3 genre).
- 2026-10-09: Like button on tracks (stored in the browser, synchronized between tabs) that feeds the Favorites page.
- 2026-10-09: Changed: the sort selector is shared by albums, categories and hashtag pages (translation keys `tri.*` replace `albums.tri*`); the site header style no longer applies to page headers; Playwright tests use a rich fixture catalogue (multi-disc album, shared hashtags, track in two categories).
- 2026-10-09: Search (Phase 5): live results panel in the header grouped by type, accent- and case-insensitive, keyboard navigation, full results page, artist pages.
- 2026-10-09: Favorites for albums and a Favorites page listing liked albums and tracks (also linked from the navigation bar); "Add to queue" for tracks and whole albums with announcements.
- 2026-10-09: Local playlists: create, rename, delete with confirmation, reorder, remove tracks, add tracks or whole albums from any card, export and import as JSON (validated, never overwrites).
- 2026-10-09: Changed: the header has two rows (brand, search and language; navigation and category filter); the like button is generic over a favorites store; the `favoris.vide` text now mentions albums. Fixed: `aria-expanded` is not allowed on a search box and was removed (reported by axe).
- 2026-10-09: Sharing and SEO (Phase 6): "Copy link" for tracks and albums (with "Start at" for tracks), shared links that start playback at the requested instant (`?t=1m30s`), static share pages with Open Graph and Twitter Card tags generated at build time, Open Graph tags on the home page, `404.html`, `sitemap.xml`, `robots.txt`.
- 2026-10-09: Opt-in downloads: MP3 link per track and album ZIP built in the browser (new `telechargement` field in `album.json`), with a license file.
- 2026-10-09: Fixed: the waveform of a track page stopped drawing when playback started during page construction (its listener detached itself before the element was inserted); a regression test covers it. Playwright now has projects for the autoplay-allowed and autoplay-blocked policies.
