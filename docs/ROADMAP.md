# Ariadne's Thread — Implementation Roadmap

> Based on PRD v2.0 · Last updated: 2026-03-30

## Current State

Step 1 of the two-step wizard is implemented: home page form with collection input (real-time validation), Minecraft version selector, and mod loader selector. API proxy routes, ModrinthClient (v3/v2 fallback, rate limiting, retries), state management, Zod schemas, SEO routes, and 40+ shadcn-svelte UI components are in place.

**What's missing**: everything from "Next" onward — version resolution, dependency resolution, the `/review` route, download engine, sharing, and advanced settings.

---

## Phase 1: Resolution Engine

> **Goal**: Server-side version resolution, dependency resolution, and side classification — the algorithmic core of the app. No UI changes. Fully unit-testable.

### Deliverables

| File                                      | Purpose                                                                                                                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/services/types.ts`               | Shared types: `ResolvedProject`, `DependencyNode`, `ConflictEntry`, `ResolutionWarning`                                                                                               |
| `src/lib/services/resolution.server.ts`   | Version resolution per PRD Section 5: filter by game_versions + loaders, cross-loader fallback, prefer release > beta > alpha, prefer featured, pick most recent, select primary file |
| `src/lib/services/dependency.server.ts`   | Recursive dependency resolution with cycle detection, depth limit (`MAX_DEPENDENCY_DEPTH`), parallelized batch resolution per depth level                                             |
| `src/lib/services/side-classification.ts` | Full side classification matching all 10 rows of the PRD table (including `unknown` handling)                                                                                         |

### Supporting Changes

- Add to `src/lib/config/constants.ts`: `CROSS_LOADER_FALLBACKS`, `MAX_DEPENDENCY_DEPTH`, advanced settings defaults
- Add `reviewParamsSchema` to `src/lib/schemas/collection.ts` for `/review` query param validation (`c`, `v`, `l`, `opts`, `x`, `add`)
- Update `getModCategory()` in `src/lib/api/types.ts` to use new side-classification module

### Acceptance Criteria

- [ ] Version resolution picks correct version for project/loader/game-version
- [ ] Cross-loader fallback works (Quilt -> Fabric, NeoForge -> Forge, no reverse)
- [ ] Dependency resolution recurses with cycle detection and depth limit
- [ ] Incompatible dependencies register as conflicts
- [ ] Side classification covers all PRD table rows
- [ ] Unit tests pass for all services

---

## Phase 2: Review Route (Core)

> **Goal**: Create the `/review` route — the heart of the app. Server load runs full resolution, page displays results with mod cards.

### Deliverables

| File                                                 | Purpose                                                                                                                                                      |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/routes/review/+page.server.ts`                  | Server load: parse query params (Zod), fetch collections, batch-fetch projects, run version + dependency resolution, classify sides, return resolved dataset |
| `src/routes/review/+page.svelte`                     | Review page layout with collection sections, side sub-groups, mod cards, summary bar, filter bar                                                             |
| `src/lib/components/review/ModCard.svelte`           | Tier 1 fields: icon, title, description, loader badge, side badge, version type, resolved version, file size, dep count, compatibility status                |
| `src/lib/components/review/SummaryBar.svelte`        | Sticky top bar: stats, total download size, download/share button placeholders                                                                               |
| `src/lib/components/review/FilterBar.svelte`         | Search + side filter + status filter (client-side)                                                                                                           |
| `src/lib/components/review/CollectionSection.svelte` | Collapsible collection group with side sub-groups                                                                                                            |

### Supporting Changes

- Change `CollectionForm.svelte` submit from POST form action to `goto('/review?...')` with query param construction
- Simplify `src/routes/+page.server.ts` (remove `actions` export)

### Acceptance Criteria

- [ ] Home page "Next" builds correct query params and navigates to `/review`
- [ ] `/review?c=...&v=...&l=...` works as a direct shareable link
- [ ] Server load handles all resolution steps
- [ ] Mod cards display all Tier 1 fields
- [ ] Collection sections collapsible with side sub-grouping
- [ ] Client-side filter by name, side, and status works
- [ ] Error states display gracefully

---

## Phase 3: Review Polish

> **Goal**: Complete information tiers, view modes, conflict resolution, and URL state management.

### Deliverables

| File                                                 | Purpose                                                                              |
| ---------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `src/lib/components/review/ModCardExpanded.svelte`   | Tier 3 accordion: dependency tree, changelog, file hashes, version override, gallery |
| `src/lib/components/review/ConflictPanel.svelte`     | Conflict resolution panel (top of page, only when conflicts exist)                   |
| `src/lib/components/review/DependencySection.svelte` | Auto-resolved deps section with "dependency of: X" annotations                       |
| `src/lib/components/review/CompactRow.svelte`        | Dense row for compact view mode                                                      |

### Supporting Changes

- Add Tier 2 hover detail row to `ModCard.svelte` (categories, download count, license, last updated, filename, cross-loader badge)
- Add view mode toggle (detailed/compact) to `SummaryBar.svelte`
- Wire `replaceState` URL updates on exclusion/override changes
- Handle `x` (excluded) and `add` (manually added) query params in server load

### Acceptance Criteria

- [ ] Tier 2 visible on hover, Tier 3 expands via accordion
- [ ] View mode toggle switches between detailed cards and compact list
- [ ] Conflict panel allows excluding one of two conflicting mods
- [ ] Per-mod version override works
- [ ] URL updates via `replaceState` on every user interaction

---

## Phase 4: Download Engine

> **Goal**: Client-side ZIP generation with concurrent downloads, progress tracking, hash verification, and inline state transition.

### Deliverables

| File                                                | Purpose                                                                                                                                                |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `src/lib/services/download.ts`                      | Concurrent file fetching from Modrinth CDN, configurable parallelism, retry with backoff, `ReadableStream` progress tracking                           |
| `src/lib/services/zip.ts`                           | fflate ZIP generation with directory structure per project type (`/mods`, `/resourcepacks`, `/shaderpacks`, `/datapacks`), separate client/server ZIPs |
| `src/lib/services/integrity.ts`                     | SHA-1 hash verification via Web Crypto API                                                                                                             |
| `src/lib/state/download.svelte.ts`                  | Download progress state: per-file status (queued/downloading/verifying/complete/error), overall progress, speed, ETA                                   |
| `src/lib/components/review/DownloadProgress.svelte` | Inline download progress UI replacing card layout during download                                                                                      |
| `src/lib/components/review/DownloadRow.svelte`      | Compact per-file progress row                                                                                                                          |

### Supporting Changes

- Wire download buttons in `+page.svelte` to download engine
- Implement inline state transition (idle -> downloading -> verifying -> zipping -> complete -> error)
- Add `beforeunload` warning during download, cancel button

### Acceptance Criteria

- [ ] "Download Client ZIP" / "Download Server ZIP" triggers download flow
- [ ] Concurrent downloads (default 4, configurable)
- [ ] Per-file and overall progress tracking visible
- [ ] SHA-1 hash verification after each file
- [ ] Two separate ZIPs with correct directory structure
- [ ] Failed files show retry button
- [ ] Cancel stops in-progress downloads

---

## Phase 5: Advanced Settings & Sharing

> **Goal**: Advanced settings panel, shareable link copy, email sharing, security headers, web manifest.

### Deliverables

| File                                               | Purpose                                                                                                                            |
| -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `src/lib/components/forms/AdvancedSettings.svelte` | Collapsible panel: optional deps toggle, alpha/beta toggle, cross-loader fallback toggle, concurrent downloads slider, retry count |
| `src/lib/components/review/SharePanel.svelte`      | Copy-to-clipboard + email form (curator name, recipient email, message)                                                            |
| `src/routes/api/share/email/+server.ts`            | POST endpoint for Resend email                                                                                                     |
| `src/hooks.server.ts`                              | Security headers: CSP, X-Frame-Options, X-Content-Type-Options, Referrer-Policy, Permissions-Policy                                |
| `src/routes/site.webmanifest/+server.ts`           | Dynamic web manifest from `siteConfig`                                                                                             |

### Supporting Changes

- Integrate `AdvancedSettings` into `CollectionForm.svelte`
- Add advanced settings fields to schemas
- Add `RESEND_API_KEY` (optional) to env schema
- Wire `opts` query param to advanced settings behavior

### Acceptance Criteria

- [ ] Advanced settings panel works with sensible defaults (PRD Section 7)
- [ ] Settings propagate to URL `opts` param
- [ ] Copy-link copies current page URL
- [ ] Email sends via Resend with correct template
- [ ] Missing RESEND_API_KEY gracefully disables email (not a hard error)
- [ ] Security headers applied to all responses
- [ ] `/site.webmanifest` returns valid JSON

---

## Phase 6: SEO & Responsive Polish

> **Goal**: Dynamic meta tags, structured data, mobile layout, final polish.

### Deliverables

| File                                       | Purpose                                                                                  |
| ------------------------------------------ | ---------------------------------------------------------------------------------------- |
| `src/lib/components/MetaTags.svelte`       | Reusable `<svelte:head>` component: title pattern, OG tags, Twitter cards, canonical URL |
| `src/lib/components/StructuredData.svelte` | JSON-LD WebApplication schema                                                            |

### Supporting Changes

- Add `MetaTags` to home page (static overrides) and review page (dynamic title/description from resolved data)
- Add `StructuredData` to home page
- Mobile responsive layout: single-column, collapsed collection sections by default, sticky bottom download bar
- Update `sitemap.xml` to include `/review`
- Verify favicon links in `app.html`

### Acceptance Criteria

- [ ] Every page has correct `<title>`, meta description, canonical URL, OG/Twitter tags
- [ ] `/review` title: "Review: {collection names} — {count} mods for MC {version} {loader}"
- [ ] JSON-LD renders on home page
- [ ] Mobile: single column, sticky bottom bar, collapsed sections
- [ ] Desktop: multi-column card grid within side groups
