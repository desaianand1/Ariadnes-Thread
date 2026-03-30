# Ariadne's Thread — Product Requirements Document

> **Version**: 2.0 · **Date**: 2026-03-30 · **Status**: Draft
> **Domain**: modrinth.download · **Stack**: SvelteKit + Cloudflare Pages

---

## 1. Problem

Modrinth collections are bookmarks, not modpacks. They store a flat list of project IDs with no version pinning, no loader targeting, and no dependency resolution. For a player who curates three collections totaling 50+ mods:

1. **No version resolution** — each mod must be manually matched to the correct Minecraft version and loader. A collection doesn't know if you're on 1.20.1 Fabric or 1.21 NeoForge.
2. **No dependency resolution** — Sodium requires Indium which requires Fabric API. The user discovers this one 404 at a time.
3. **No side separation** — server admins downloading a collection get client-only mods mixed in, and vice versa. There's no way to say "give me just the server JARs."
4. **No shareability** — a curator can share a collection URL, but the recipient still has to manually configure version, loader, and click through every download. There's no "here's exactly what you need" link.
5. **No bulk download** — Modrinth has no "download all" button. 50 mods = 50 individual clicks, 50 file saves.

## 2. Solution

Ariadne's Thread is a web tool that takes one or more Modrinth collection URLs, resolves every mod to the correct version for a target Minecraft release and mod loader, recursively resolves all dependencies, separates mods by side (client/server/both), and packages everything into downloadable ZIPs — one for client, one for server.

Curators generate a shareable link or send an email. Recipients land on a pre-configured review page and download with minimal friction.

---

## 3. User Personas

### Curator

A modded Minecraft player who maintains collections on Modrinth and wants to share a ready-to-play mod set with friends or a server community.

**Flow**: Visits site → enters collection URLs → selects MC version and loader → clicks Next → reviews resolved mods on `/review` → generates a shareable link or sends an email → done.

### Recipient

A player who receives a shared link (via Discord, email, etc.) from a curator.

**Flow**: Opens `/review?c=...&v=...&l=...` link → lands directly on the review page with everything pre-resolved → scans the mod list → downloads client or server ZIP → done.

### Direct User

A player downloading mods for themselves, no sharing involved.

**Flow**: Same as curator, but uses the download buttons instead of sharing.

---

## 4. Two-Step Wizard

A two-step URL-routed wizard. Each step is a SvelteKit route with its own URL, enabling browser navigation and direct linking.

| Step                      | Route                       | Purpose                                               |
| ------------------------- | --------------------------- | ----------------------------------------------------- |
| **1 — Configure**         | `/`                         | Input collections, select version/loader, set options |
| **2 — Review & Download** | `/review?c=...&v=...&l=...` | Review resolved mods, download ZIPs, share            |

Navigation: "Next" on Step 1 navigates to `/review` with all configuration encoded as URL query parameters. No "Back" button on Step 2 — users use browser back or start fresh at `/`.

### Step 1 — Configure

| Element               | Details                                                                                                                                                                                                                |
| --------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Collection inputs** | Up to 7 URL/ID fields. Validated in real-time via debounced API calls (500ms). On success: show collection name, icon (`icon_url`), description, project count, color accent border. On failure: inline error message. |
| **Minecraft version** | Select dropdown. Grouped: "Popular Releases" (major versions) + "All Versions." Version type badges for snapshots/betas.                                                                                               |
| **Mod loader**        | Select dropdown. Grouped: "Popular" (Fabric, Forge, Quilt, NeoForge) / "Other" / "Server Plugins." Loader icon + name.                                                                                                 |
| **Advanced settings** | Collapsible panel, closed by default. See [Section 7](#7-advanced-settings).                                                                                                                                           |

**Validation gate**: At least one valid collection + MC version + loader selected before "Next" enables.

**On submit**: Construct URL query params from form state and navigate to `/review?c=id1,id2&v=1.20.1&l=fabric&opts=d,f` via SvelteKit's `goto()`.

### Step 2 — Review & Download

This is the core of the app. The `/review` route serves double duty as the review page and the shareable link target.

**Server load**: On navigation to `/review`, the server load function:

1. Parses and validates all query params via Zod
2. Fetches collections and batch-fetches all projects
3. Runs version resolution for every project
4. Runs recursive dependency resolution
5. Detects conflicts and classifies mods by side
6. Returns the full resolved dataset to the page

#### Sticky Summary Bar

Always visible at the top of the viewport as the user scrolls. Contains:

- **Stats**: "47 compatible · 2 warnings · 1 conflict" with colored indicators
- **Total download size**: Formatted (e.g., "23.4 MB")
- **Download buttons**: [Download Client ZIP] [Download Server ZIP]
- **Share button**: Opens share section (copy link + email)

#### Information Hierarchy

The review step uses a three-tier progressive disclosure model:

**Tier 1 — Always Visible (card surface)**

Every mod renders as a compact card. The following are always visible without interaction:

| Field                | Source                                                     | Display                                                            |
| -------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------ |
| Icon                 | `Project.icon_url`                                         | 40x40px rounded square, fallback to first letter of title          |
| Title                | `Project.title`                                            | Primary text, bold                                                 |
| Short description    | `Project.description`                                      | Secondary text, single line, truncated with ellipsis               |
| Loader badge(s)      | `Version.loaders`                                          | Colored pill badges (e.g., "Fabric" in teal)                       |
| Side badge           | Derived from `Project.client_side` + `Project.server_side` | "Client" (blue) / "Server" (orange) / "Both" (green)               |
| Version type         | `Version.version_type`                                     | "release" (no badge) / "beta" (yellow badge) / "alpha" (red badge) |
| Resolved version     | `Version.version_number`                                   | e.g., "0.5.11"                                                     |
| File size            | `VersionFile.size`                                         | Formatted, e.g., "2.4 MB"                                          |
| Dependency count     | `Version.dependencies.length`                              | e.g., "3 deps" — clickable to expand                               |
| Project type icon    | `Project.project_type`                                     | Small icon distinguishing mod / resourcepack / shader / datapack   |
| Compatibility status | Computed                                                   | Checkmark (compatible) / Warning triangle / Error X                |

**Tier 2 — Visible on Hover or Compact Detail Row**

Shown in a subtle detail row below the card surface, or on hover/focus:

| Field                           | Source                                                                                     |
| ------------------------------- | ------------------------------------------------------------------------------------------ |
| Categories                      | `Project.categories` as subtle tags                                                        |
| Download count                  | `Project.downloads`, formatted (e.g., "1.2M downloads")                                    |
| License                         | `Project.license.name` (e.g., "MIT", "LGPL-3.0")                                           |
| Last updated                    | `Version.date_published`, relative (e.g., "3 days ago")                                    |
| Filename                        | `VersionFile.filename`                                                                     |
| Cross-loader fallback indicator | Badge if version is from a compatible loader (e.g., "via Fabric" when user selected Quilt) |

**Tier 3 — Expandable Accordion**

Revealed when the user clicks to expand a mod card:

| Field                    | Source                                                                                          |
| ------------------------ | ----------------------------------------------------------------------------------------------- |
| Dependency tree          | Recursive `Version.dependencies` with type indicators (required/optional/incompatible/embedded) |
| Changelog                | `Version.changelog` (rendered markdown, if available)                                           |
| File hashes              | `VersionFile.hashes.sha512` (truncated, copyable)                                               |
| All compatible versions  | List of other resolved versions user could pin                                                  |
| Gallery                  | `Project.gallery` images (if any)                                                               |
| Per-mod version override | Dropdown to select a different version                                                          |

#### View Modes

Two view modes, togglable via a control in the summary bar:

- **Detailed view** (default): Full mod cards with Tier 1 fields visible
- **Compact view**: Dense list rows showing only icon + title + side badge + version + status — optimized for scanning 50+ mods quickly

#### Search & Filter

A filter bar below the sticky summary bar:

- **Search**: Filter mods by name (client-side, instant)
- **Side filter**: All / Client / Server / Both
- **Status filter**: All / Compatible / Warnings / Conflicts

#### Grouping & Layout

```text
┌─ Collection: "Essential Mods" (icon · 23 mods) ──────── [Collapse]
│
│  ── Client (12) ──────────────────────────────────────
│  ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ Mod Card │ │ Mod Card │ │ Mod Card │  ...
│  └──────────┘ └──────────┘ └──────────┘
│
│  ── Server (8) ───────────────────────────────────────
│  ┌──────────┐ ┌──────────┐
│  │ Mod Card │ │ Mod Card │  ...
│  └──────────┘ └──────────┘
│
│  ── Both (3) ─────────────────────────────────────────
│  ┌──────────┐ ┌──────────┐ ┌──────────┐
│  │ Mod Card │ │ Mod Card │ │ Mod Card │
│  └──────────┘ └──────────┘ └──────────┘
└───────────────────────────────────────────────────────
```

- **Collection sections** are collapsible. Header shows collection icon, name, color accent (from `Collection.color`), and total mod count.
- **Side sub-groups** within each collection. Header shows side label and count.
- **Dependencies section** below all collections, showing auto-resolved dependencies with "dependency of: X" annotations.

#### Side Classification Logic

| `client_side` | `server_side` | Classification                | Included in       |
| ------------- | ------------- | ----------------------------- | ----------------- |
| required      | unsupported   | Client                        | Client ZIP only   |
| required      | optional      | Client                        | Client ZIP only   |
| optional      | required      | Server                        | Server ZIP only   |
| unsupported   | required      | Server                        | Server ZIP only   |
| required      | required      | Both                          | Both ZIPs         |
| optional      | optional      | Both                          | Both ZIPs         |
| optional      | unsupported   | Client                        | Client ZIP only   |
| unsupported   | optional      | Server                        | Server ZIP only   |
| unknown       | \*            | Treat `unknown` as `optional` | Apply rules above |
| \*            | unknown       | Treat `unknown` as `optional` | Apply rules above |

Mods classified as "Both" are included in **both** the client and server ZIPs.

#### Warnings & Conflicts

- **Compatibility warnings** (yellow): Mod has no release for the exact version/loader combo but a cross-loader fallback was used, or only a beta/alpha version is available. Displayed as an inline alert within the mod card.
- **Conflicts** (red): Two mods declare each other as `incompatible` via dependencies. Displayed in a dedicated **Conflict Resolution Panel** that appears at the top of Step 2 only when conflicts exist. Each conflict shows both mods with a choice to exclude one.
- **Missing dependencies** (orange): A required dependency couldn't be resolved on Modrinth. Shows a prompt to manually add via URL/ID or link to external sources (CurseForge, GitHub).

#### Manual Dependency Addition

A panel (collapsed by default) allowing users to add mods not found automatically:

- Input: Modrinth project URL/ID — validated and resolved like collection inputs
- External link field: For mods only available on CurseForge/GitHub (included as a text note in the download, not auto-downloaded)

#### Download — Inline State Transition

When a user clicks a download button, the review page transforms in-place. The mod card layout collapses into a compact progress view. This is not a modal or overlay — the page itself changes state and cannot be dismissed or navigated away from during download.

| Phase           | UI State                                                                                                                                                                                                                                                                                                      |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Idle**        | Summary bar shows download buttons. Mod cards visible in normal review layout.                                                                                                                                                                                                                                |
| **Downloading** | Summary bar transforms to a progress bar showing file count, download speed, and ETA. Mod cards collapse into compact progress rows: icon + name + file size + status indicator (queued / downloading with % / done / error). Cancel button available. `beforeunload` warning prevents accidental navigation. |
| **Verifying**   | Progress bar shows "Verifying file integrity..." Individual files show hash verification status.                                                                                                                                                                                                              |
| **Zipping**     | Progress bar shows "Building ZIP..."                                                                                                                                                                                                                                                                          |
| **Complete**    | Summary bar shows "Client ZIP ready (12.3 MB)" with a [Save ZIP] button. Offers option to also download Server ZIP. [Back to Review] button restores the card view.                                                                                                                                           |
| **Error**       | Failed files shown with retry button and error message. Partial download available for completed files.                                                                                                                                                                                                       |

Per-file progress states:

- `queued` — waiting for download slot
- `downloading` — active, shows percentage and speed (via `ReadableStream` progress tracking)
- `verifying` — hash check in progress
- `complete` — checkmark
- `error` — retry button with error message

#### Share

Located at the bottom of the review page:

| Element            | Details                                                                                                                                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Shareable link** | The current page URL (includes all params). Copy-to-clipboard button. URL updates via `replaceState` as user makes changes (exclusions, overrides).                                                    |
| **Email**          | Form: curator name (optional), recipient email, optional personal message. Sent server-side via Resend. Email contains collection summary, download button linking to the shareable URL, and branding. |

#### Responsive Behavior

- **Desktop**: Multi-column card grid within each side group
- **Mobile**: Single-column layout. Collection sections default-collapsed. Download actions in a sticky bottom bar instead of the top summary bar.

---

## 5. Core Features (V1)

### Collection Management

- Input validation against Modrinth v3 collection API
- Support URL formats: `https://modrinth.com/collection/{id}`, raw collection IDs
- Up to 7 collections (configurable via `MAX_COLLECTIONS` constant)
- Real-time preview on valid input: collection name, icon, description, project count, color accent
- Deduplication: if the same project appears in multiple collections, it appears once (under the first collection that contains it) with a subtle "also in: Collection B" note

### Version Resolution

For each project in each collection, resolve the best version:

1. Filter versions by target `game_versions` and `loaders`
2. If cross-loader fallback is enabled, also try compatible loaders using the fallback map: `{ quilt: ['fabric'], neoforge: ['forge'] }` — no reverse fallback
3. Prefer `version_type: release` over `beta` over `alpha` (unless alpha/beta toggle is on)
4. Prefer `featured: true` versions
5. Among remaining candidates, pick the most recently published (`date_published`)
6. Select the `primary: true` file from the chosen version

### Dependency Resolution

Recursive, parallelized, with safety limits:

```python
resolve(project, depth=0):
  if depth > MAX_DEPENDENCY_DEPTH: warn and stop
  if project in visited: return (cycle detection)
  visited.add(project)

  version = resolveVersion(project)
  for dep in version.dependencies:
    if dep.dependency_type == "required":
      resolve(dep.project_id, depth+1)
    if dep.dependency_type == "optional" AND includeOptionalDeps:
      resolve(dep.project_id, depth+1)
    if dep.dependency_type == "incompatible":
      register conflict(project, dep.project_id)
    if dep.dependency_type == "embedded":
      skip (already bundled in parent JAR)
```

- Max recursion depth: 10 (configurable via `MAX_DEPENDENCY_DEPTH` constant)
- Cycle detection via visited set
- Parallelized: batch-resolve all dependencies at each depth level before descending
- Dependencies are added to the mod list with a "dependency of: X" annotation

### Cross-Loader Compatibility

- **ON by default**. Togglable in advanced settings.
- Fallback chains defined as a constant map: `{ quilt: ['fabric'], neoforge: ['forge'] }`
- When a fallback is used, the mod card shows a "via Fabric" (or equivalent) badge
- No fallback in the reverse direction (Fabric does not fall back to Quilt)

### Non-Mod Project Types

Modrinth projects include resource packs, data packs, shaders, and modpacks. Collections can contain any of these.

| `project_type` | ZIP directory    | Notes                                    |
| -------------- | ---------------- | ---------------------------------------- |
| `mod`          | `/mods`          | Standard mod JARs                        |
| `resourcepack` | `/resourcepacks` | Texture/resource packs                   |
| `shader`       | `/shaderpacks`   | Shader packs (Iris/OptiFine)             |
| `datapack`     | `/datapacks`     | Data packs                               |
| `modpack`      | Skipped          | Already a packaged format; warn the user |

### Conflict Handling

1. **Auto-resolvable**: If mod A declares mod B as `incompatible` and mod B is only an optional dependency, auto-exclude B with a warning.
2. **User-resolvable**: If both mods are explicitly in collections, surface in the Conflict Resolution Panel. User picks which to exclude.
3. **Blocking**: If a required dependency is incompatible with another required dependency, block download and explain.

### Download Engine

- **Client-side** ZIP generation using `fflate`
- Files downloaded via Modrinth CDN URLs (`VersionFile.url`)
- Concurrent downloads: configurable (default 4, max 8)
- Retry: exponential backoff, configurable max retries (default 3)
- Integrity: verify `sha1` hash from `VersionFile.hashes` after download via Web Crypto API
- Two separate ZIPs: client and server, each with the directory structure above
- Progress tracking via `ReadableStream` + `getReader()` with `Content-Length` awareness

---

## 6. Shareable Links

### URL Encoding Scheme

All state is encoded in the `/review` route's URL query parameters. No server-side storage required. The shareable link IS the review page URL.

```
https://modrinth.download/review?c=abc123,def456&v=1.20.1&l=fabric&opts=d,f
```

| Param  | Description                                                     | Example                                                                            |
| ------ | --------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| `c`    | Comma-separated collection IDs                                  | `abc123,def456`                                                                    |
| `v`    | Minecraft version                                               | `1.20.1`                                                                           |
| `l`    | Mod loader slug                                                 | `fabric`                                                                           |
| `opts` | Comma-separated option flags                                    | `d` = include optional deps, `f` = cross-loader fallback, `a` = include alpha/beta |
| `x`    | Comma-separated excluded project IDs (from conflict resolution) | `proj1,proj2`                                                                      |
| `add`  | Comma-separated manually added project IDs                      | `proj3,proj4`                                                                      |

When a recipient opens a shareable link, the `/review` route's server load function parses the params, runs full resolution, and renders the review page directly. No wizard-skip logic — `/review` is a standalone route.

As users interact with the review page (excluding mods, overriding versions, adding manual deps), the URL updates in real-time via `replaceState`, keeping the shareable link always current.

### Email Sharing

Server-side via Resend API, using `better-svelte-email` for templates.

**Email content**:

- Subject: "{Curator name}'s Minecraft Mods — Ariadne's Thread"
- Body:
  - Personal message from curator (if provided)
  - Summary: collection names, mod count, MC version, loader
  - Branded "Download Mods" button linking to the `/review` shareable URL
  - Footer: site branding, support link

---

## 7. Advanced Settings

Collapsible panel in Step 1, closed by default. All settings have sensible defaults so most users never touch them.

| Setting                       | Default | Description                                                                        |
| ----------------------------- | ------- | ---------------------------------------------------------------------------------- |
| Include optional dependencies | `true`  | Resolve and include mods marked as `optional` in dependency graphs                 |
| Include alpha/beta versions   | `false` | Allow pre-release versions when no stable release matches                          |
| Cross-loader fallback         | `true`  | Try compatible loaders (Quilt->Fabric, NeoForge->Forge) when no exact match exists |
| Max concurrent downloads      | `4`     | Slider, range 1-8. Controls parallelism during ZIP generation                      |
| Retry count                   | `3`     | Number of retry attempts per failed download                                       |

**Per-mod overrides** (in Step 2, within expanded mod cards):

- Version pin: Select a specific version instead of the auto-resolved one
- Exclude: Remove a mod from the download

---

## 8. Technical Architecture

### Stack

- **Frontend**: SvelteKit 5 (Svelte 5 runes), TypeScript
- **Hosting**: Cloudflare Pages (edge SSR + static)
- **UI**: shadcn-svelte component library, Tailwind CSS v4
- **ZIP**: `fflate` (client-side, sync compression)
- **Email**: Resend API + `better-svelte-email`
- **Validation**: Zod schemas + `sveltekit-superforms`
- **State**: Svelte 5 runes (`$state`, `$derived`) in module-level stores

### Routing

| Route                              | Method | Purpose                                           |
| ---------------------------------- | ------ | ------------------------------------------------- |
| `/`                                | GET    | Step 1: Configure form                            |
| `/review`                          | GET    | Step 2: Review & Download (shareable link target) |
| `/api/modrinth/collection/[id]`    | GET    | Fetch collection metadata + batch projects        |
| `/api/modrinth/project/[id]`       | GET    | Fetch project details + versions                  |
| `/api/modrinth/tags/game-versions` | GET    | Fetch MC versions (cached 1h)                     |
| `/api/modrinth/tags/loaders`       | GET    | Fetch mod loaders (cached 1h)                     |
| `/api/share/email`                 | POST   | Send email via Resend                             |
| `/robots.txt`                      | GET    | Dynamic robots.txt                                |
| `/sitemap.xml`                     | GET    | Dynamic sitemap                                   |
| `/site.webmanifest`                | GET    | Dynamic web app manifest                          |

### Server vs Client Responsibilities

| Concern                       | Where                                          | Why                                                                      |
| ----------------------------- | ---------------------------------------------- | ------------------------------------------------------------------------ |
| Modrinth API calls            | Server (SvelteKit API routes + load functions) | Hide API patterns, cache responses, respect rate limits (300/min)        |
| Version/dependency resolution | Server (`/review` load function)               | Requires many sequential API calls; cacheable; keeps client bundle small |
| ZIP generation                | Client                                         | Large binary data; no reason to route through server                     |
| File downloads                | Client (direct from Modrinth CDN)              | CDN is fast; server would be a bottleneck                                |
| Email sending                 | Server                                         | Requires Resend API key (secret)                                         |
| Share link generation         | Client                                         | Stateless URL encoding via `replaceState`                                |
| SEO meta tags                 | Server (SSR)                                   | Must be in initial HTML for crawlers                                     |
| Security headers              | Server (`hooks.server.ts`)                     | Applied to all responses                                                 |
| Download progress state       | Client (`$state` runes)                        | Ephemeral, per-session                                                   |

### Resolution Service Architecture

Version and dependency resolution runs server-side in the `/review` route's load function, calling `ModrinthClient` directly (no internal HTTP round-trip).

| Service               | Location                                | Purpose                                                                    |
| --------------------- | --------------------------------------- | -------------------------------------------------------------------------- |
| Version resolution    | `src/lib/services/resolution.server.ts` | Resolve best version per the algorithm in [Section 5](#version-resolution) |
| Dependency resolution | `src/lib/services/dependency.server.ts` | Recursive dependency resolution with cycle detection                       |

### Modrinth API Optimization

Bulk endpoints to minimize API calls:

| Endpoint                                                         | Use Case                                                              |
| ---------------------------------------------------------------- | --------------------------------------------------------------------- |
| `GET /v2/projects?ids=[...]`                                     | Batch fetch up to 100 projects per request (for collection contents)  |
| `GET /v2/project/{id}/version?loaders=[...]&game_versions=[...]` | Pre-filtered version fetch (reduces payload vs fetching all versions) |
| `GET /v2/versions?ids=[...]`                                     | Bulk version lookup for pinned dependency versions                    |
| `POST /v2/version_files/update`                                  | Batch-check compatible versions across multiple mods                  |

### Caching Strategy

| Data                     | Server Cache-Control | Stale-While-Revalidate | Client Cache             |
| ------------------------ | -------------------- | ---------------------- | ------------------------ |
| Tags (versions, loaders) | 1 hour               | 24 hours               | localStorage, 2-hour TTL |
| Collection               | 30 minutes           | 1 hour                 | —                        |
| Project (with filters)   | 15 minutes           | 30 minutes             | —                        |
| Project (no filters)     | 30 minutes           | 1 hour                 | —                        |

---

## 9. Modrinth Data Model Reference

Key fields consumed by the UI, sourced from Modrinth's API.

### Collection (v3 API)

```text
id              string      Base62 identifier
name            string      Human-friendly name
description     string?     Optional description
icon_url        string?     CDN URL for collection icon
color           number?     Decimal color code for accent
status          enum        listed | unlisted | private | rejected
projects        string[]    Array of project IDs
```

### Project (v2 API)

```text
id              string      Base62 identifier
slug            string      URL-friendly identifier (e.g., "sodium")
title           string      Human-friendly name
description     string      Short description (one-liner)
icon_url        string?     CDN URL for project icon
color           number?     Decimal color code
project_type    enum        mod | modpack | resourcepack | shader | datapack | plugin
client_side     enum        required | optional | unsupported | unknown
server_side     enum        required | optional | unsupported | unknown
categories      string[]    Category tags (e.g., "optimization", "library")
loaders         string[]    Supported loaders (e.g., ["fabric", "quilt"])
game_versions   string[]    Supported MC versions
downloads       integer     Total download count
license         object      { id, name, url }
gallery         object[]    Screenshot images
```

### Version (v2 API)

```text
id              string      Base62 identifier
project_id      string      Parent project ID
name            string      Version display name (e.g., "v2.5.1")
version_number  string      Semantic version (e.g., "2.5.1")
version_type    enum        release | beta | alpha
game_versions   string[]    Compatible MC versions
loaders         string[]    Compatible loaders
featured        boolean     Highlighted by author
date_published  string      ISO-8601 timestamp
downloads       integer     Download count for this version
changelog       string?     Markdown changelog
files           File[]      Downloadable files
dependencies    Dep[]       Dependencies
```

### VersionFile

```text
url             string      Direct CDN download URL
filename        string      e.g., "sodium-fabric-mc1.20.1-0.5.11.jar"
primary         boolean     Main file for this version
size            integer     File size in bytes
hashes          object      { sha1: string, sha512: string }
file_type       enum?       required-resource-pack | optional-resource-pack | ...
```

### VersionDependency

```text
project_id      string?     Dependency project ID
version_id      string?     Specific version ID (if pinned)
file_name       string?     Filename for external dependencies
dependency_type enum        required | optional | incompatible | embedded
```

---

## 10. V2 Roadmap

Features deferred from V1 but planned:

| Feature                | Value                                                     | Notes                                    |
| ---------------------- | --------------------------------------------------------- | ---------------------------------------- |
| **.mrpack generation** | One-click import into launchers (Prism, ATLauncher, etc.) | Uses Modrinth's modpack format spec      |
| **Short links**        | Shorter shareable URLs via Cloudflare KV                  | `modrinth.download/s/abc123` -> full URL |
| **Modpack export**     | Export resolved mod list as a modpack to Modrinth         | Requires Modrinth auth                   |
| **Diff mode**          | Compare two shareable links to see what changed           | Useful for collection updates            |
| **Bulk update check**  | Given a previous download, check for mod updates          | Requires storing previous state          |

---

## 11. SEO & Web Metadata

### Dynamic Meta Tags

All pages render meta tags server-side in `<svelte:head>` via a reusable `MetaTags` component. Defaults are sourced from `siteConfig`.

**Tags rendered on every page**:

- `<title>` — pattern: `{Page Title} | Ariadne's Thread`
- `<meta name="description">`
- `<link rel="canonical">`
- OpenGraph: `og:title`, `og:description`, `og:image`, `og:url`, `og:type` (website), `og:locale`, `og:site_name`
- Twitter: `twitter:card` (summary_large_image), `twitter:title`, `twitter:description`, `twitter:image`

**Per-page overrides**:

| Route     | Title                                                                 | Description                                                                                                                   |
| --------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| `/`       | "Ariadne's Thread — Modrinth Collection Downloader"                   | "Download Modrinth mod collections as ready-to-play ZIPs. Resolve versions, dependencies, and side separation automatically." |
| `/review` | "Review: {collection names} — {count} mods for MC {version} {loader}" | Dynamic description including collection names, mod count, version, and loader.                                               |

### Structured Data

JSON-LD `WebApplication` schema on the home page:

```json
{
	"@context": "https://schema.org",
	"@type": "WebApplication",
	"name": "Ariadne's Thread",
	"description": "Modrinth mod collection downloader with version resolution and dependency management",
	"url": "https://modrinth.download",
	"applicationCategory": "GameApplication",
	"operatingSystem": "Any"
}
```

### Programmatic SEO Routes

| Route               | Content                                                                |
| ------------------- | ---------------------------------------------------------------------- |
| `/robots.txt`       | `Allow: /`, `Disallow: /api/`, `Sitemap: {baseUrl}/sitemap.xml`        |
| `/sitemap.xml`      | Static sitemap with `/` and `/review` routes                           |
| `/site.webmanifest` | Generated from `siteConfig`: app name, short name, theme colors, icons |

All three are SvelteKit `+server.ts` routes (not static files) so they can reference `siteConfig` for the canonical URL and theme colors.

### Favicon

- Primary: SVG favicon (`/favicon.svg`)
- Fallbacks: PNG at 16x16, 32x32, 192x192, 512x512
- Apple touch icon: 180x180 PNG

---

## 12. Security

### HTTP Security Headers

Applied to all responses via `hooks.server.ts`:

| Header                    | Value                                                                                                                                                                                                    |
| ------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Content-Security-Policy` | `default-src 'self'`; allow `cdn.modrinth.com` and `cdn-raw.modrinth.com` for `img-src` and `connect-src`; `script-src 'self' 'unsafe-inline'` (SvelteKit hydration); `style-src 'self' 'unsafe-inline'` |
| `X-Frame-Options`         | `DENY`                                                                                                                                                                                                   |
| `X-Content-Type-Options`  | `nosniff`                                                                                                                                                                                                |
| `Referrer-Policy`         | `strict-origin-when-cross-origin`                                                                                                                                                                        |
| `Permissions-Policy`      | `camera=(), microphone=(), geolocation=()`                                                                                                                                                               |

### Input Validation

- All API route parameters validated with regex patterns before use
- Form inputs validated via Zod schemas on both client and server
- Collection IDs: `/^[a-zA-Z0-9]+$/`
- Project IDs/slugs: `/^[a-zA-Z0-9_-]+$/`

### Content Sanitization

- SVG icons from Modrinth loader API sanitized server-side via DOMPurify with `USE_PROFILES: { svg: true }`
- Markdown changelogs rendered with sanitization

### Secret Management

- **RESEND_API_KEY**: Stored as a Cloudflare Pages secret (`wrangler secret put RESEND_API_KEY`)
- Server-only: imported via `$env/static/private` or platform bindings, never exposed to client bundle
- No other secrets required for V1

### API Security

- `/api/` routes intended for same-origin use only
- Modrinth rate limits respected via queue-based client (300 requests/min)
- `robots.txt` disallows `/api/` to prevent crawler traffic

---

## 13. Configuration & Defaults Strategy

### Centralized Constants

All magic numbers, categorization lists, cache TTLs, and limits live in `src/lib/config/constants.ts`. No magic values scattered across components.

Key constants:

| Constant                   | Value                                        | Purpose                                   |
| -------------------------- | -------------------------------------------- | ----------------------------------------- |
| `MAX_COLLECTIONS`          | 7                                            | Maximum collection inputs                 |
| `MAX_DEPENDENCY_DEPTH`     | 10                                           | Recursion limit for dependency resolution |
| `MAX_CONCURRENT_DOWNLOADS` | 5                                            | Default download parallelism              |
| `MAX_RETRIES`              | 3                                            | Default retry count                       |
| `CROSS_LOADER_FALLBACKS`   | `{ quilt: ['fabric'], neoforge: ['forge'] }` | Loader fallback chains                    |
| `CACHE_TTL.VERSIONS`       | 2 hours                                      | Client-side tag cache TTL                 |
| `CACHE_TTL.LOADERS`        | 2 hours                                      | Client-side tag cache TTL                 |
| `CACHE_TTL.COLLECTIONS`    | 30 minutes                                   | Client-side collection cache TTL          |

### Environment Validation

Server-side environment variables validated at boot via Zod schema in `src/lib/config/env.server.ts`:

- `MODRINTH_API_URL` — URL, default `https://api.modrinth.com`
- `MODRINTH_USER_AGENT` — string, identifies the app to Modrinth
- `MAX_REQUESTS_PER_MINUTE` — 1-500, default 300
- `MAX_RETRIES` — 0-10, default 3
- `RETRY_DELAY_MS` — 0-10000, default 1000
- `RETRY_BACKOFF_STRATEGY` — `exponential` | `linear` | `fixed`
- `RESEND_API_KEY` — optional string (only required for email sharing)

Supports both standard `process.env` and Cloudflare platform bindings (`platform.env`).

### Site Metadata

Centralized in `src/lib/config/site.ts`: app name, canonical URL, author, theme colors, keywords, support email. Referenced by SEO components, web manifest, and email templates.

### Client-Side Caching

Browser localStorage with TTL, managed via `src/lib/utils/cache.ts`. SSR-safe (checks for `typeof window`). Used for tags (versions, loaders) to avoid redundant API calls.
