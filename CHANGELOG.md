## [1.29.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.29.0...v1.29.1) (2026-04-20)

### Bug Fixes

- dockerignore out/ directory ignore ([27ee6d4](https://github.com/desaianand1/Ariadnes-Thread/commit/27ee6d45e785e87dde7b970c204eaa2d0513547b))

# [1.29.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.6...v1.29.0) (2026-04-20)

### Bug Fixes

- **security:** harden share email validation and defang user-supplied URLs ([98a53b7](https://github.com/desaianand1/Ariadnes-Thread/commit/98a53b740bbfb50b953d2d8af7d27a89e7a1972c))

### Features

- **docker:** harden container with read-only rootfs and loopback binding ([0ed5122](https://github.com/desaianand1/Ariadnes-Thread/commit/0ed5122b62a4b1fa35a58c99cd660c685b551646))
- **landing:** redesign hero section with bento feature grid ([f7ae566](https://github.com/desaianand1/Ariadnes-Thread/commit/f7ae566c0ec9e3747bba0f6a87550327735058e4))
- **security:** add scanner path blocking, tiered bot scoring, and CSP reporting ([271e7fc](https://github.com/desaianand1/Ariadnes-Thread/commit/271e7fc737757f50e7617dba19cd4cedd90d5cdc))
- **security:** harden Turnstile with action/hostname verification and invisible mode ([9ad18d1](https://github.com/desaianand1/Ariadnes-Thread/commit/9ad18d13ac24d814d9a8d5b06c2a35e4c6d81eff))
- **ui:** add tagline to header and Minecraft attribution to footer ([ec0f107](https://github.com/desaianand1/Ariadnes-Thread/commit/ec0f107c4668a5f4813dfd6feeec1235c73f5edc))

## [1.28.6](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.5...v1.28.6) (2026-04-15)

### Bug Fixes

- add cloudflare turnstile and challenge platform to CSP ([69f1a2e](https://github.com/desaianand1/Ariadnes-Thread/commit/69f1a2e894ddab88d92704934c08eafb9b617cf6))
- **docker:** always pull latest image on deploy ([0db44c4](https://github.com/desaianand1/Ariadnes-Thread/commit/0db44c45d9274ef35af19f6ac12bfe0a0b81354c))
- tooltip positioning and 'Not available found' text ([162aa48](https://github.com/desaianand1/Ariadnes-Thread/commit/162aa4832e4478803f5496daaf54b17200cd5e3d))
- widen min-width on download progress counters ([3c58c74](https://github.com/desaianand1/Ariadnes-Thread/commit/3c58c74971ebc9b55b783b0b9cb9e2ec93bcfa61))

## [1.28.5](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.4...v1.28.5) (2026-04-15)

### Performance Improvements

- improve config limits for better rate limits ([4e54db0](https://github.com/desaianand1/Ariadnes-Thread/commit/4e54db03d538f76d8543709026b71e00c483121f))

## [1.28.4](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.3...v1.28.4) (2026-04-15)

### Bug Fixes

- **ci:** allow semantic-release to run when one build job is skipped ([a72a961](https://github.com/desaianand1/Ariadnes-Thread/commit/a72a9610f7c8916ecd35254abb58bdafc6dd9ff8))
- **docker:** include pnpm-workspace.yaml and rebuild better-sqlite3 native addon ([29efb5b](https://github.com/desaianand1/Ariadnes-Thread/commit/29efb5b0bf49fea8bef802fea0fd623c5d4f295f))
- **docker:** let pnpm 10 onlyBuiltDependencies handle better-sqlite3 native addon ([4005d17](https://github.com/desaianand1/Ariadnes-Thread/commit/4005d179c79d9f6ff4ee10ae7bb64dde49aa5d55))

## [1.28.3](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.2...v1.28.3) (2026-04-15)

### Bug Fixes

- **docker:** reuse deps stage for prod-deps to preserve native addon ([1afcb7e](https://github.com/desaianand1/Ariadnes-Thread/commit/1afcb7e68e4bbc828360a729ef116c644c3660cc))

## [1.28.2](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.1...v1.28.2) (2026-04-15)

### Bug Fixes

- exempt /api/health from bot detection for Docker HEALTHCHECK ([dd13987](https://github.com/desaianand1/Ariadnes-Thread/commit/dd13987ca6a8f833c7b4641e678f9e2ca67448c9))

## [1.28.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.28.0...v1.28.1) (2026-04-15)

### Bug Fixes

- **docker:** skip prepare script in prod-deps, add DEPLOY_TARGET gate ([be7fdbe](https://github.com/desaianand1/Ariadnes-Thread/commit/be7fdbef1d9a4ae7f4933e8329e5a06005b05098))

# [1.28.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.27.2...v1.28.0) (2026-04-15)

### Features

- **vps:** add SQLite resolution cache for VPS deployment ([bfd2584](https://github.com/desaianand1/Ariadnes-Thread/commit/bfd2584b38db89651eb591235e2ad968833d2d58))

## [1.27.2](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.27.1...v1.27.2) (2026-04-10)

### Bug Fixes

- **do:** honor full Retry-After, batch SQL params, batch fallback resolution ([1fd3b7c](https://github.com/desaianand1/Ariadnes-Thread/commit/1fd3b7c86d3987b41f21d6c1f40e84437cf6e679))

## [1.27.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.27.0...v1.27.1) (2026-04-10)

### Performance Improvements

- **do:** pre-filter incompatible projects before API calls ([cddbe7c](https://github.com/desaianand1/Ariadnes-Thread/commit/cddbe7cb973d418421ae314eb54bcf9cea367bf6))

# [1.27.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.26.4...v1.27.0) (2026-04-09)

### Bug Fixes

- **advisor:** replace console.warn with structured logger ([00be6f3](https://github.com/desaianand1/Ariadnes-Thread/commit/00be6f3950850d58789148bbb3e6e1a724c60079))
- **api:** correct rate-limit header interpretation and cap wait time ([2083b5f](https://github.com/desaianand1/Ariadnes-Thread/commit/2083b5f5eb84be24d2ca8f38fec1c7c68984d3e4))
- downgrade log level back to 'warn' and downsample for prod config post issue ([9f71d2b](https://github.com/desaianand1/Ariadnes-Thread/commit/9f71d2b0568e594575719f1d5ea48441207c622c))
- **download:** correct mini-progress side label and add tabular-nums ([af6d986](https://github.com/desaianand1/Ariadnes-Thread/commit/af6d98650faa7d8be13df00e44fed26689a3f916))
- **review:** hide hero UI after download completes ([c8fa144](https://github.com/desaianand1/Ariadnes-Thread/commit/c8fa1447c7949ca11ba8422a737652df240fe6f4))
- **review:** wire abort signal through prefetch and add resilient DO fallback ([613edbe](https://github.com/desaianand1/Ariadnes-Thread/commit/613edbe5a2816f70c42649336068d6b739964f59))

### Features

- **ui:** add useStableValue utility to dampen ETA/speed jitter ([35fce8f](https://github.com/desaianand1/Ariadnes-Thread/commit/35fce8f097b5167ebe67a14a5c7f41436f46e76d))

### Performance Improvements

- **api:** skip project batch fetch for home page validation ([15a2c4e](https://github.com/desaianand1/Ariadnes-Thread/commit/15a2c4eb96702b1c65e2ee4b8823d709a5632ddb))

## [1.26.4](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.26.3...v1.26.4) (2026-04-09)

### Bug Fixes

- bump log level and sampling for prod pre-fetch diagnosis replication ([e601b61](https://github.com/desaianand1/Ariadnes-Thread/commit/e601b614aa914ed560ee5b69ebeb864fd97e89a7))

## [1.26.3](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.26.2...v1.26.3) (2026-04-09)

### Bug Fixes

- **api:** use server reset time for rate-limit wait calculation ([6daee91](https://github.com/desaianand1/Ariadnes-Thread/commit/6daee91cfd100a326a291a838f882b6058234f8e))

## [1.26.2](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.26.1...v1.26.2) (2026-04-09)

### Bug Fixes

- **logging:** replace console.\* with structured JSON logger ([9d21741](https://github.com/desaianand1/Ariadnes-Thread/commit/9d217416f121709b4198c79e6655f469514b6476))

## [1.26.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.26.0...v1.26.1) (2026-04-09)

### Bug Fixes

- **deploy:** resolve env symbol collision and harden wrangler config ([81e2235](https://github.com/desaianand1/Ariadnes-Thread/commit/81e2235ba00a0522f5b0e4226e445bbdd01f5924))

# [1.26.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.25.3...v1.26.0) (2026-04-09)

### Bug Fixes

- **download:** prevent mod details UI from being visible when mini download view is active ([634a76b](https://github.com/desaianand1/Ariadnes-Thread/commit/634a76b6c2932ee331b536c85c97428696ce755b))

### Features

- add Durable Objects resolution cache with SQLite storage ([1a4c575](https://github.com/desaianand1/Ariadnes-Thread/commit/1a4c575f967f96ca8de42b9fd2ecba63a561dba2))
- integrate resolution cache into review pipeline ([d4d53ca](https://github.com/desaianand1/Ariadnes-Thread/commit/d4d53cace4f49d2abfe8cd29caf3489571eb9470))

## [1.25.3](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.25.2...v1.25.3) (2026-04-07)

### Bug Fixes

- **config:** pre-fetch timeout was too restrictive, loosened defaults ([0f5836a](https://github.com/desaianand1/Ariadnes-Thread/commit/0f5836a172c771632f66757f576a424712f218b5))

## [1.25.2](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.25.1...v1.25.2) (2026-04-07)

### Bug Fixes

- **review:** prevent timeout for medium-sized collections (46-150 mods) ([f722569](https://github.com/desaianand1/Ariadnes-Thread/commit/f72256984dd238714edd5b43105029d3b4da77ab))
- **security:** add static.cloudflareinsights.com to CSP connect-src ([ba81eaf](https://github.com/desaianand1/Ariadnes-Thread/commit/ba81eaf01229bc70c8d534727c7c04b0bbe2e5af))

## [1.25.1](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.25.0...v1.25.1) (2026-04-07)

### Bug Fixes

- **README:** add missing badges to README ([b80fd2a](https://github.com/desaianand1/Ariadnes-Thread/commit/b80fd2a28912bbcbd2a6aaed6896a25aaee487da))

# [1.25.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.24.0...v1.25.0) (2026-04-07)

### Features

- **share:** add share route with hero and spotlight cards ([82f5a56](https://github.com/desaianand1/Ariadnes-Thread/commit/82f5a56463ae17f78d85a6e10c52a7da710f8779))

# [1.24.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.23.0...v1.24.0) (2026-04-07)

### Features

- **download:** track completed sides and improve download UX ([70b2827](https://github.com/desaianand1/Ariadnes-Thread/commit/70b2827b7292d76baf887ca1ad35ca0e2466c24c))
- **review:** add category summary computation ([8e71a52](https://github.com/desaianand1/Ariadnes-Thread/commit/8e71a523ece59993127639f8e231ed7e375bec70))
- **share:** add share URL builder with curator name param ([37f4ddc](https://github.com/desaianand1/Ariadnes-Thread/commit/37f4ddc18282f9ad942d14c2ea2efa862f4d7a7b))

# [1.23.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.22.0...v1.23.0) (2026-04-07)

### Features

- **review:** redesign review page with simple/detailed views and config advisor ([b8048f4](https://github.com/desaianand1/Ariadnes-Thread/commit/b8048f479cdd4285eade82bde8a47a99f34a7974))

# [1.22.0](https://github.com/desaianand1/Ariadnes-Thread/compare/v1.21.1...v1.22.0) (2026-04-07)

### Features

- **advisor:** add best configuration advisor with histogram-guided probing ([7d83845](https://github.com/desaianand1/Ariadnes-Thread/commit/7d838454c6d686140b92450861f949c0ba560d4b))
- **api:** add Cloudflare rate-limit handling, retry jitter, and batched resolution ([3840e1f](https://github.com/desaianand1/Ariadnes-Thread/commit/3840e1f9d66c76906eb1617ec9f83cb40ef8aa45))

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
