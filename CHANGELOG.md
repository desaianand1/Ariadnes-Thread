## [1.21.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.21.0...v1.21.1) (2026-04-03)

### Bug Fixes

- **a11y:** add accessible names to combobox triggers and logo links ([10aaa42](https://github.com/desaianand1/Ariadnes-Thread/commit/10aaa42df64da53fd976e4ca9d0938ce0bf19e84))
- **csp:** allow Cloudflare Web Analytics beacon in CSP headers ([49d867f](https://github.com/desaianand1/Ariadnes-Thread/commit/49d867f934d0cfc47929bf41e74313ddf74d788b))

### Performance Improvements

- **home:** lazy-load DotGrid to defer GSAP from critical path ([9b86810](https://github.com/desaianand1/Ariadnes-Thread/commit/9b86810019c508d958394470aa4639d0b2abbd0d))

# [1.21.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.20.0...v1.21.0) (2026-04-03)

### Features

- **security:** add centralized sanitization utility for all runtimes ([874f4b4](https://github.com/desaianand1/Ariadnes-Thread/commit/874f4b4661f8df467f139e118624808df9dbf569))

# [1.20.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.19.0...v1.20.0) (2026-04-03)

### Bug Fixes

- **a11y:** improve mobile responsive layout and touch targets ([da94c8f](https://github.com/desaianand1/Ariadnes-Thread/commit/da94c8f65a99fcb9c5eae49a599fd96e5f876033))
- **effects:** normalize oklch colors via canvas in DotGrid ([9f7d490](https://github.com/desaianand1/Ariadnes-Thread/commit/9f7d490206597018cb492c394ffb83a947111f6b)), closes [#rrggbb](https://github.com/desaianand1/Ariadnes-Thread/issues/rrggbb)
- **review:** clear timeout to prevent unhandled rejection crash ([59b4bf0](https://github.com/desaianand1/Ariadnes-Thread/commit/59b4bf02ef5ffd7889832d0237c4a88a3950dc0c))

### Features

- **downloads:** improve download flow for server AND client side mod zipping, sharing etc ([bb21e8f](https://github.com/desaianand1/Ariadnes-Thread/commit/bb21e8f7a214237b8ce5891b7ce05638bc85cc1c))
- **review:** add mod status derivation, filtering, and enriched metadata ([37386de](https://github.com/desaianand1/Ariadnes-Thread/commit/37386deee1d9e5cb9344fbf8616f55ee746bd27e))
- **review:** graceful error handling with empty response fallback ([8533c54](https://github.com/desaianand1/Ariadnes-Thread/commit/8533c5480d44b138841f7908ca185aa46fe919ca))
- **seo:** add favicon variants and update icon config ([93df55a](https://github.com/desaianand1/Ariadnes-Thread/commit/93df55ab1c1d155a61751fab73243aac64980162))
- **seo:** add JSON-LD WebApplication structured data on home page ([e931077](https://github.com/desaianand1/Ariadnes-Thread/commit/e9310774e03460eefcca00029a7068535ea76971))
- **seo:** harden MetaTags with twitter image, keywords, and author ([785e4d8](https://github.com/desaianand1/Ariadnes-Thread/commit/785e4d8d63532dec6757e85679db83502b1294ae))
- **share:** add ENABLE_EMAIL_SHARING env feature flag ([741aab1](https://github.com/desaianand1/Ariadnes-Thread/commit/741aab1327860890dabcc2f88fbb163cac7a8162))
- **share:** add Web Share API, QR code, and Discord copy to SharePanel ([42c2a9e](https://github.com/desaianand1/Ariadnes-Thread/commit/42c2a9e10082fd38669b1c1517a3c02f6fda453c))
- **ui:** add chart shadcn-svelte components and review error page ([4048f27](https://github.com/desaianand1/Ariadnes-Thread/commit/4048f27b456c1418496b58fa33868d20e5fe4ae2))

# [1.19.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.18.3...v1.19.0) (2026-04-02)

### Bug Fixes

- **a11y:** add Space key support and aria-labels to review route ([076c38f](https://github.com/desaianand1/Ariadnes-Thread/commit/076c38f3336bdb6ccb1701332fc18fe01f5de0cf))
- **deploy:** stub Node built-ins for Cloudflare Workers compatibility ([02e46cf](https://github.com/desaianand1/Ariadnes-Thread/commit/02e46cfb368b203acb9299157a8e536da6ef5b1c))
- **review:** disambiguate download labels and stack buttons on mobile ([170f0f7](https://github.com/desaianand1/Ariadnes-Thread/commit/170f0f7237098bef37305e87ec21eec1b58898b8))
- **review:** filter download confirmation by side and add cancel button ([72a2bfa](https://github.com/desaianand1/Ariadnes-Thread/commit/72a2bfadb93bc8f2525b6aef2bd98fce21a0434d))
- **review:** reset tab state when switching mods in detail sheet ([4c8ee81](https://github.com/desaianand1/Ariadnes-Thread/commit/4c8ee810c3559609026f1b9b5d5bd27ec7d075af))
- **review:** show active conflict count and prevent tab override ([218bbce](https://github.com/desaianand1/Ariadnes-Thread/commit/218bbcea55db340fb083a8dc7c5752db6e4449fd))

### Features

- **email:** integrate Turnstile bot protection into email sharing ([c596e54](https://github.com/desaianand1/Ariadnes-Thread/commit/c596e546777952aaf159e0503af19310a8a6f385))
- **review:** detect OS and show copyable paths in install guides ([9cdb5c6](https://github.com/desaianand1/Ariadnes-Thread/commit/9cdb5c6ec6f571a44c983a7d6482ac8430e668f6))
- **turnstile:** add Turnstile component and server-side verification ([9bdc519](https://github.com/desaianand1/Ariadnes-Thread/commit/9bdc5197d9cf1bfc0f80d84c4c4211377d6b17e6))

## [1.18.3](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.18.2...v1.18.3) (2026-04-02)

### Bug Fixes

- **ci:** switch from Cloudflare Pages to Workers deploy config ([4b7a078](https://github.com/desaianand1/Ariadnes-Thread/commit/4b7a0782b175d0504c100908291b7c15342a99fe))

## [1.18.2](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.18.1...v1.18.2) (2026-04-02)

### Bug Fixes

- **ci:** use wrangler deploy instead of legacy pages deploy ([36c688d](https://github.com/desaianand1/Ariadnes-Thread/commit/36c688d1588bc86304a4c1d9b236acdd9b67b823))

## [1.18.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.18.0...v1.18.1) (2026-04-02)

### Bug Fixes

- **api:** restore error message return in getErrorMessage fallback ([7c1de19](https://github.com/desaianand1/Ariadnes-Thread/commit/7c1de19c4f30a430969928f1de59bee9ea3f5660))

# 1.0.0 (2026-03-30)

### Features

- added API client for calling Modrinth API ([ca5fe0d](https://github.com/desaianand1/Ariadnes-Thread/commit/ca5fe0d37ba86e7ed0aa657ace8d358513eb611a))
- added boilerplate initial files ([124442e](https://github.com/desaianand1/Ariadnes-Thread/commit/124442e23885d45cd6c4ca5bd3bd8ad18de62313))
- added boilerplate metadata and theme colors ([699ab43](https://github.com/desaianand1/Ariadnes-Thread/commit/699ab433fc9027985be823eb3c5c91f2272164a2))
- added env parsing and utils for app configuration ([63203de](https://github.com/desaianand1/Ariadnes-Thread/commit/63203def62a079fb89246ef743421b4d9946659b))
- added several UI components for MVP ([81210d9](https://github.com/desaianand1/Ariadnes-Thread/commit/81210d9fdf0a68f87d5ef7e4c1e02d59e62afadf))
- **api:** Add SvelteKit API routes for Modrinth proxy ([453e955](https://github.com/desaianand1/Ariadnes-Thread/commit/453e955b1e96634d9b16544553f1be2d317926bd))
- began basic form submission schema ([3409400](https://github.com/desaianand1/Ariadnes-Thread/commit/3409400d654d8bedb7a89e6711fb567964b00d33))
- **config:** Add centralized constants and server configuration ([e43fc83](https://github.com/desaianand1/Ariadnes-Thread/commit/e43fc830fa9ff0969332a8924008747e702dc9a8))
- **forms:** Add collection download form components ([300c772](https://github.com/desaianand1/Ariadnes-Thread/commit/300c7729d4a9aecad4772083dda01b7f52ac2e74))
- initial svelte starter ([fcac5d1](https://github.com/desaianand1/Ariadnes-Thread/commit/fcac5d140ea3f3f8bfba57112691b53e4faf1a92))
- **mvp:** add initial rework for new MVP phase ([eeebd62](https://github.com/desaianand1/Ariadnes-Thread/commit/eeebd62aa83bd9f75151418ccd3916ea8beee98b))
- **phase-1:** implemented phase 1 implementation based on roadmap ([a9940db](https://github.com/desaianand1/Ariadnes-Thread/commit/a9940dbd70bff9e40a670aaec8309e8a28f2df9f))
- **routes:** add main page with collection download form ([e87c2d2](https://github.com/desaianand1/Ariadnes-Thread/commit/e87c2d273044844522852ac2ef6cdf83203a661e))
- **schemas:** Add Zod validation schemas for forms ([032acb6](https://github.com/desaianand1/Ariadnes-Thread/commit/032acb634e6340fd0b1b4441137b72516e4411a1))
- **state:** Add Svelte 5 runes-based state management ([ac36b1b](https://github.com/desaianand1/Ariadnes-Thread/commit/ac36b1b976a4e312d9923bc9f25e88cd61b6a42e))
- **ui:** Add new shadcn-svelte components ([0378ad9](https://github.com/desaianand1/Ariadnes-Thread/commit/0378ad96e8ed20e6b5b3e48d4dc1b34f10f8ea24))
- **utils:** Update utility functions with type safety ([1c73a9a](https://github.com/desaianand1/Ariadnes-Thread/commit/1c73a9aa3138463bfc51b97fbebc78dfc31c417d))
