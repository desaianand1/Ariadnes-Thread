<div align="center">

# 🧵 Ariadne's Thread

**Download your Modrinth collections as ready-to-play ZIPs.**

![Ariadne's Thread](/static/og-image.png)

[![Live Site](https://img.shields.io/badge/modrinth.download-live-1bd96a?style=for-the-badge&logo=modrinth&logoColor=white)](https://modrinth.download)
[![License: FSL-1.1-ALv2](https://img.shields.io/badge/license-FSL--1.1--ALv2-blue?style=for-the-badge)](LICENSE.md)
[![Built with SvelteKit](https://img.shields.io/badge/SvelteKit-FF3E00?style=for-the-badge&logo=svelte&logoColor=white)](https://svelte.dev)
[![Deployed on Cloudflare](https://img.shields.io/badge/Cloudflare%20Pages-F38020?style=for-the-badge&logo=cloudflare&logoColor=white)](https://pages.cloudflare.com)

[![Ko-fi](https://img.shields.io/badge/Ko--fi-FF5E5B?style=for-the-badge&logo=ko-fi&logoColor=white)](https://ko-fi.com/ananddesai)
[![Buy Me a Coffee](https://img.shields.io/badge/Buy%20Me%20a%20Coffee-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/ananddesai)

</div>

---

Modrinth collections are bookmarks — not modpacks. They don't resolve versions, handle dependencies, or separate client and server mods. Downloading 50+ mods means 50+ individual clicks.

**Ariadne's Thread fixes that.** Paste your Modrinth collection URLs, pick your Minecraft version and mod loader, and get two ZIPs: one for client, one for server. Share a single link with friends and they get the exact same setup.

## How It Works

1. **Paste** one or more Modrinth collection URLs
2. **Pick** your Minecraft version and mod loader (Fabric, Forge, Quilt, NeoForge)
3. **Review** the resolved mod list — versions matched, dependencies included, conflicts flagged
4. **Download** client and server ZIPs, organized into `/mods`, `/resourcepacks`, `/shaderpacks`, and `/datapacks`

## Features

- **Version resolution** — automatically matches each mod to your Minecraft version and loader
- **Dependency resolution** — recursively finds and includes required dependencies
- **Side separation** — splits mods into client-only, server-only, and shared
- **Cross-loader fallback** — Quilt falls back to Fabric mods, NeoForge to Forge
- **Conflict detection** — flags incompatible mods before you download
- **Shareable links** — every configuration is encoded in the URL, no account needed
- **Bulk download** — concurrent downloads with progress tracking and hash verification

## Supported Content

| Type           | ZIP Directory    |
| -------------- | ---------------- |
| Mods           | `/mods`          |
| Resource Packs | `/resourcepacks` |
| Shaders        | `/shaderpacks`   |
| Data Packs     | `/datapacks`     |

---

## Development

> Requires [Node.js](https://nodejs.org) 18+ and [pnpm](https://pnpm.io).

```sh
pnpm install
pnpm dev
```

| Command        | Purpose                  |
| -------------- | ------------------------ |
| `pnpm dev`     | Start dev server         |
| `pnpm build`   | Production build         |
| `pnpm preview` | Preview production build |

---

## Support

If you find Ariadne's Thread useful, consider supporting its development:

- [Ko-fi](https://ko-fi.com/ananddesai)
- [Buy Me a Coffee](https://buymeacoffee.com/ananddesai)

## License

This project is source-available under the [Functional Source License (FSL-1.1-ALv2)](LICENSE.md). You can read, audit, and learn from the code. After two years, each release converts to the Apache 2.0 license.

---

<div align="center">

⚒️ Crafted by [Nirnshard](https://nirnshard.com)

</div>
