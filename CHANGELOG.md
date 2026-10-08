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
