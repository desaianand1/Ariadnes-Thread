# Deployment Guide

## Architecture Overview

```
GitHub (push/PR)
  │
  ├─► CI workflow ──► lint, type-check, test, build
  │                        │
  │                        └─► semantic-release (main only)
  │                                  │
  │                                  ▼
  │                           GitHub Release
  │                                  │
  └──────────────────────────────────┘
                                     │
                              Release workflow
                                     │
                                     ▼
                          Cloudflare Workers (wrangler)
                                     │
                                     ▼
                           modrinth.download
```

**Services used:**

| Service              | Purpose                                  |
| -------------------- | ---------------------------------------- |
| Cloudflare Workers   | Hosting (edge SSR + static assets)       |
| Cloudflare DNS       | DNS management, SSL termination          |
| Cloudflare Turnstile | Bot protection for email form (required) |
| Resend               | Transactional email sending (optional)   |
| GitHub Actions       | CI/CD pipeline                           |

---

## Prerequisites

- **Accounts**: Cloudflare, GitHub, Resend (optional)
- **Tools**: Node.js 24+, pnpm, wrangler CLI (`pnpm add -g wrangler`)
- **Domain**: `modrinth.download` with nameservers pointed to Cloudflare

---

## 1. Cloudflare Workers Setup

### Create the Workers project

The Workers project is defined by `wrangler.toml` and **auto-created** on the first deployment. When `release.yml` runs `wrangler deploy`, wrangler creates the worker if it doesn't already exist.

No manual project creation is needed — just ensure `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set as GitHub secrets before the first release.

> **Note:** Variables and secrets cannot be set on a worker that has only static assets. You must deploy the full worker (with its script) at least once before the dashboard will allow setting environment variables. Run a manual deploy first if needed (see [Manual deployment](#manual-deployment-escape-hatch)).

### Custom domain

1. **Workers & Pages → ariadnes-thread → Custom domains → Add**
2. Add `modrinth.download` — Cloudflare auto-creates the required CNAME record
3. Add `www.modrinth.download` — configure a redirect rule to the apex domain:
    - **Rules → Redirect Rules → Create Rule**
    - Match: hostname equals `www.modrinth.download`
    - Action: Dynamic redirect to `https://modrinth.download${http.request.uri.path}`
    - Status code: 301

---

## 2. DNS & SSL Configuration

### SSL/TLS settings

Cloudflare Dashboard → **SSL/TLS**:

| Setting                  | Value                                               |
| ------------------------ | --------------------------------------------------- |
| Encryption mode          | Full (strict)                                       |
| Always Use HTTPS         | On                                                  |
| Automatic HTTPS Rewrites | On                                                  |
| Minimum TLS Version      | TLS 1.2                                             |
| HSTS                     | Enable (max-age 1 year, includeSubDomains, preload) |

The app also sets HSTS headers server-side via `hooks.server.ts` as defense-in-depth.

### Email routing (for support@modrinth.download)

1. Cloudflare Dashboard → **Email Routing → Enable**
2. Add a route: `support@modrinth.download` → forward to your personal email
3. Cloudflare will prompt you to add the required MX and TXT DNS records — accept them

### DNS records summary

After full setup, your DNS zone should contain:

| Type      | Name                    | Content                       | Proxy                             |
| --------- | ----------------------- | ----------------------------- | --------------------------------- |
| CNAME     | `modrinth.download`     | `ariadnes-thread.workers.dev` | Proxied (auto-created by Workers) |
| CNAME     | `www`                   | `modrinth.download`           | Proxied                           |
| MX        | `modrinth.download`     | _(Cloudflare Email Routing)_  | —                                 |
| TXT       | `modrinth.download`     | `v=spf1 include:...`          | —                                 |
| TXT/CNAME | _(Resend DKIM records)_ | _(see Resend section)_        | —                                 |

---

## 3. Email Setup (Resend)

Resend powers the share-via-email feature. This is optional — the app gracefully degrades without it.

### Domain verification

1. [Resend Dashboard](https://resend.com) → **Domains → Add Domain** → `modrinth.download`
2. Resend provides DNS records to add (SPF, DKIM, DMARC). Add them in Cloudflare DNS:
    - **SPF**: TXT record on `modrinth.download` — merge with existing SPF if present
    - **DKIM**: CNAME records (typically 3, e.g., `resend._domainkey`)
    - **DMARC**: TXT record on `_dmarc.modrinth.download`
3. Click **Verify** in Resend — typically takes a few minutes

### API key

1. Resend Dashboard → **API Keys → Create**
2. Name: `ariadnes-thread-production`
3. Permission: **Sending access only**
4. Domain: `modrinth.download`
5. Copy the `re_xxxxxxxxxxxx` key

### Template sync

After configuring Resend, sync email templates:

```bash
RESEND_API_KEY=re_xxxxxxxxxxxx pnpm run email:sync
```

This renders the Svelte email components to HTML and pushes them to Resend as managed templates. Re-run after any template changes.

---

## 4. Bot Protection (Cloudflare Turnstile)

Required. Protects the email sharing form from automated abuse. The email form will not submit without a valid Turnstile token.

1. Cloudflare Dashboard → **Turnstile → Add site**
2. Domain: `modrinth.download`
3. Widget type: **Managed**
4. Copy the **Site Key** (public, embedded in client widget) and **Secret Key** (private, server-side verification)
5. Set them in Cloudflare production environment variables (dashboard or CLI):
    - `TURNSTILE_SECRET_KEY` → **Encrypt** (secret, server-side verification)
    - `PUBLIC_TURNSTILE_SITE_KEY` → **Plain text** (public, client-side widget)

    Via CLI (useful before the first deploy when the dashboard blocks variable creation):

    ```bash
    wrangler secret put TURNSTILE_SECRET_KEY
    ```

For local development, Cloudflare test keys are pre-configured in `.env.development` (always pass).

---

## 5. GitHub Actions CI/CD

### Workflow overview

| Workflow      | Trigger                  | Jobs                                                              |
| ------------- | ------------------------ | ----------------------------------------------------------------- |
| `ci.yml`      | Push to main, PRs        | validate-commits, lint, type-check, test, build, semantic-release |
| `release.yml` | GitHub release published | build, deploy to Cloudflare Workers, upload build artifact        |

### Pipeline flow

1. **Push/PR to main** → `ci.yml` runs all checks
2. **On main push** → semantic-release analyzes commits and may create a GitHub Release
3. **Release published** → `release.yml` builds and deploys via `wrangler deploy`

### Required GitHub secrets

Go to repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Secret                  | Value                                     | Required |
| ----------------------- | ----------------------------------------- | -------- |
| `CLOUDFLARE_API_TOKEN`  | Cloudflare API token (see below)          | Yes      |
| `CLOUDFLARE_ACCOUNT_ID` | Cloudflare account ID (dashboard sidebar) | Yes      |
| `RELEASE_PAT`           | GitHub fine-grained PAT (see below)       | Yes      |

### Creating the Cloudflare API token

1. Cloudflare Dashboard → **My Profile → API Tokens → Create Token**
2. Use the **"Edit Cloudflare Workers"** template, or create custom:
    - Permission: `Account → Cloudflare Workers Scripts → Edit`
    - Account Resources: your account
3. Copy the token

### Creating the GitHub PAT (`RELEASE_PAT`)

semantic-release needs a PAT (not the default `GITHUB_TOKEN`) to create releases that trigger downstream workflows.

1. GitHub → **Settings → Developer Settings → Personal Access Tokens → Fine-grained tokens**
2. Repository access: **Only select** `Ariadnes-Thread`
3. Permissions: **Contents** (read/write), **Issues** (read/write), **Pull Requests** (read/write)
4. Generate and copy

---

## 6. Environment Variables Reference

All server-side env vars are validated via Zod in `src/lib/config/env.server.ts`. Every variable has a sensible default — you only need to set secrets and any overrides.

### Server-side variables

| Variable                   | Default                    | Description                        |
| -------------------------- | -------------------------- | ---------------------------------- |
| `MODRINTH_API_URL`         | `https://api.modrinth.com` | Modrinth API base URL              |
| `MODRINTH_USER_AGENT`      | `Ariadne/{version}`        | User-Agent for API requests        |
| `MAX_REQUESTS_PER_MINUTE`  | `300`                      | Rate limit threshold               |
| `RESET_INTERVAL_SECONDS`   | `60`                       | Rate limit window                  |
| `MAX_RETRIES`              | `3`                        | Download retry attempts            |
| `RETRY_DELAY_MS`           | `1000`                     | Base retry delay                   |
| `RETRY_BACKOFF_STRATEGY`   | `exponential`              | `exponential` / `linear` / `fixed` |
| `MAX_CONCURRENT_DOWNLOADS` | `4`                        | Parallel download limit (1–10)     |
| `FETCH_TIMEOUT_MS`         | `30000`                    | HTTP request timeout               |
| `RESEND_API_KEY`           | _(none)_                   | Resend API key (optional)          |
| `TURNSTILE_SECRET_KEY`     | _(none — required)_        | Turnstile server secret            |

### Public variables

| Variable                    | Description                          |
| --------------------------- | ------------------------------------ |
| `PUBLIC_TURNSTILE_SITE_KEY` | Turnstile widget site key (required) |

### Where to set them

| Environment               | How                                                                                            |
| ------------------------- | ---------------------------------------------------------------------------------------------- |
| **Local dev**             | `.env` or `.env.development`                                                                   |
| **Cloudflare Production** | Dashboard → Workers & Pages → ariadnes-thread → Settings → Variables                           |
| **Cloudflare Preview**    | Same dashboard, select Preview environment (or `wrangler.toml [env.preview.vars]`)             |
| **GitHub Actions**        | Repo → Settings → Secrets (for `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID`, `RELEASE_PAT`) |

### Production environment variables (Cloudflare Dashboard)

| Variable                    | Type       | Notes                       |
| --------------------------- | ---------- | --------------------------- |
| `RESEND_API_KEY`            | Encrypted  | Required for email sharing  |
| `TURNSTILE_SECRET_KEY`      | Encrypted  | Required for bot protection |
| `PUBLIC_TURNSTILE_SITE_KEY` | Plain text | Client-side widget key      |

### Preview environment variables

| Variable                    | Value                                           |
| --------------------------- | ----------------------------------------------- |
| `MODRINTH_USER_AGENT`       | `AriadnesThread/preview`                        |
| `PUBLIC_TURNSTILE_SITE_KEY` | `1x00000000000000000000AA` (Turnstile test key) |

---

## 7. Domain Migration (Porkbun → Cloudflare)

If you haven't already migrated your domain's nameservers:

1. **Cloudflare Dashboard → Add a Site** → enter `modrinth.download`
2. Select the **Free** plan
3. Cloudflare scans existing DNS and imports records
4. Note the two assigned Cloudflare nameservers (e.g., `ada.ns.cloudflare.com`)
5. **Porkbun** → Domain Management → `modrinth.download` → **Nameservers**
6. Replace Porkbun's default nameservers with the two Cloudflare nameservers
7. Wait for propagation (typically minutes to a few hours)
8. Cloudflare will show the domain as **Active** once propagation completes

After migration, manage all DNS records in Cloudflare — Porkbun's DNS settings no longer apply.

---

## 8. Security Headers

The app sets security headers in `src/hooks.server.ts`. No Cloudflare configuration is needed for these — they're applied at the application layer:

- `Strict-Transport-Security` (HSTS with preload)
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy` (camera, microphone, geolocation disabled)
- `Content-Security-Policy` (allowlists for Modrinth CDN and API)

---

## 9. Deployment Checklist

### First-time setup

- [ ] Cloudflare Workers project exists (auto-created on first deploy)
- [ ] Custom domain `modrinth.download` added to Workers project
- [ ] SSL/TLS set to Full (strict), Always HTTPS enabled
- [ ] Cloudflare API token created and added to GitHub secrets
- [ ] Cloudflare Account ID added to GitHub secrets
- [ ] GitHub PAT (`RELEASE_PAT`) created and added to GitHub secrets
- [ ] (Optional) Resend domain verified, DNS records added, API key set
- [ ] Turnstile site created, keys set in Cloudflare env vars
- [ ] (Optional) Email routing configured for `support@modrinth.download`
- [ ] (Optional) Email templates synced via `pnpm run email:sync`

### Each release

Releases are automated — push conventional commits to `main`:

1. CI validates the push (lint, types, tests, build)
2. semantic-release creates a GitHub Release if warranted
3. `release.yml` deploys to Cloudflare Workers
4. Verify at `https://modrinth.download`

### Manual deployment (escape hatch)

```bash
pnpm run build
wrangler deploy
```

---

## 10. Troubleshooting

### Build fails in CI

- Check Node.js version matches `NODE_VERSION: 24` in workflows
- Run `pnpm run build` locally to reproduce
- Check `svelte-check` for type errors: `pnpm run check`

### Deployment fails

- Verify `CLOUDFLARE_API_TOKEN` has `Cloudflare Workers Scripts: Edit` permission
- Verify `CLOUDFLARE_ACCOUNT_ID` is correct (dashboard sidebar, not zone ID)
- Check wrangler version compatibility (wrangler-action@v3 in workflow)

### semantic-release doesn't create a release

- Ensure commits follow [Conventional Commits](https://www.conventionalcommits.org/) format
- `fix:` → patch, `feat:` → minor, `BREAKING CHANGE:` → major
- Check that `RELEASE_PAT` has `contents: write` permission
- The PAT must be a fine-grained token or classic token — not the default `GITHUB_TOKEN`

### Custom domain shows SSL error

- Verify SSL/TLS mode is **Full (strict)** (not Flexible)
- Wait for Cloudflare's edge certificate provisioning (up to 15 minutes)
- Check the domain is **Active** in Cloudflare (nameserver propagation complete)

### Emails not sending

- Verify `RESEND_API_KEY` is set in Cloudflare production environment variables
- Check Resend domain verification status (all DNS records must be verified)
- Run `pnpm run email:sync` to ensure templates exist in Resend
- Check Resend Dashboard → Logs for delivery status

### Environment variables not applying

- Cloudflare Workers env vars require the worker script to be deployed first — a static-assets-only worker cannot have variables set via the dashboard
- If variables/secrets are grayed out, run a manual deploy (`pnpm run build && wrangler deploy`) to initialize the worker script
- Variables set in `wrangler.toml` under `[env.preview.vars]` only apply to preview deployments
- Secrets cannot be set in `wrangler.toml` — use the dashboard or `wrangler secret put`
