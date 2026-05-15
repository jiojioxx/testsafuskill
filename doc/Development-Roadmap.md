# SafuSkill Development Roadmap

> Status tracker for all features — completed, in progress, and planned.

Last updated: 2026-03-18 (v2)

---

## Legend

| Status | Meaning |
|--------|---------|
| ✅ Done | Fully implemented and functional |
| 🔧 Partial | Core logic exists but needs polish or edge-case handling |
| 🚧 In Progress | Currently being built |
| 📋 Planned | Designed but not yet started |
| 💡 Idea | Under consideration, not committed |

---

## Phase 1: Core Platform (MVP) — ✅ Complete

### 1.1 Project Setup
| Task | Status | Notes |
|------|--------|-------|
| Monorepo structure (`packages/frontend`, `packages/backend`) | ✅ Done | npm workspaces |
| Vite + React + TypeScript frontend | ✅ Done | |
| NestJS + Prisma backend | ✅ Done | MySQL database |
| Tailwind CSS dark theme design system | ✅ Done | Custom CSS variables |
| Docker Compose (app + MySQL) | ✅ Done | Single-port production deploy |
| Environment configuration | ✅ Done | `.env` based |

### 1.2 Authentication
| Task | Status | Notes |
|------|--------|-------|
| Email verification code login | ✅ Done | Resend API, 10-min expiry |
| GitHub OAuth login | ✅ Done | Passport strategy + callback |
| Wallet login (SIWE) | ✅ Done | MetaMask, EIP-4361 |
| JWT token management | ✅ Done | 7-day expiry, auto-refresh |
| Auth state (Zustand) | ✅ Done | Persistent via localStorage |
| Login page (Email + Wallet + GitHub tabs) | ✅ Done | |
| Auth callback page | ✅ Done | Handles GitHub redirect |

### 1.3 Skill Management
| Task | Status | Notes |
|------|--------|-------|
| Skill upload (multipart .zip) | ✅ Done | Max 50MB, Multer storage |
| Skill list API (paginated) | ✅ Done | `GET /api/skills?page=&limit=` |
| Skill detail API | ✅ Done | Includes user + scan result |
| Skill download (with counter) | ✅ Done | Increments `downloadCount` |
| Skill delete (owner only) | ✅ Done | File cleanup included |
| Category filtering | ✅ Done | `?category=BNBChain%20Skills` |
| Marketplace page (grid + search + category tabs) | ✅ Done | 4-column responsive grid |
| Skill detail page (two-column layout) | ✅ Done | Security report sidebar |
| Upload page (drag & drop form) | ✅ Done | Protected route |

### 1.4 Security Scanning
| Task | Status | Notes |
|------|--------|-------|
| GoPlus AgentGuard integration | ✅ Done | `@goplus/agentguard` |
| Async scan trigger on upload | ✅ Done | `setImmediate()` |
| Scan result API | ✅ Done | `GET /api/scan/:skillId` |
| Risk level mapping (LOW → CRITICAL) | ✅ Done | Score + level + tags |
| Frontend scan polling (3s interval) | ✅ Done | Until COMPLETED/FAILED |
| Security report card (5 checks) | ✅ Done | Derives from `risk_tags` |

### 1.5 Branding & SEO
| Task | Status | Notes |
|------|--------|-------|
| Logo design (concentric hexagons) | ✅ Done | SVG component + static assets |
| Favicon (SVG, PNG, ICO) | ✅ Done | Multiple formats |
| Apple touch icon + PWA icons (192, 512) | ✅ Done | |
| Open Graph + Twitter Card meta tags | ✅ Done | `og-image.png` 1200×630 |
| SEO meta (description, keywords, robots) | ✅ Done | |
| Web App Manifest (`manifest.json`) | ✅ Done | PWA-ready |

---

## Phase 2: BNBChain Ecosystem Integration — ✅ Complete

### 2.1 GitHub Skill Crawler
| Task | Status | Notes |
|------|--------|-------|
| Prisma schema: `category`, `sourceRepo`, `sourcePath` fields | ✅ Done | Migration applied |
| System user seed (`safuskill-bot`) | ✅ Done | Fixed UUID |
| GitHub Sync service (cron every 6h) | ✅ Done | `@nestjs/schedule` |
| Repo config (`bnb-chain/bnbchain-skills`, `binance/binance-skills-hub`) | ✅ Done | Flat + nested structure |
| SKILL.md frontmatter parsing | ✅ Done | `gray-matter` |
| Skill zip packaging | ✅ Done | `archiver` |
| Upsert on `(sourceRepo, sourcePath)` unique | ✅ Done | Prevents duplicates |
| Auto-trigger scan for new crawled skills | ✅ Done | Reuses `ScanService` |
| Initial sync on application startup | ✅ Done | `onApplicationBootstrap()` |

### 2.2 BNBChain Skills Category
| Task | Status | Notes |
|------|--------|-------|
| "BNBChain Skills" as default marketplace tab | ✅ Done | Featured on load |
| Category tabs trigger real API filtering | ✅ Done | Was UI-only before |
| Backend `findAll` supports `category` query param | ✅ Done | |

---

## Phase 3: Token Launchpad — 🔧 In Progress

### 3.1 Launchpad Core
| Task | Status | Notes |
|------|--------|-------|
| Flap Protocol integration (Bonding Curve) | ✅ Done | CDPV2 formula: `(x+h)(y+r)=K` |
| Token creation page (3-step wizard) | ✅ Done | Token info → Select Skill → Tax config + Deploy |
| Tax configuration UI (presets + custom) | ✅ Done | mktBps/deflationBps/dividendBps/lpBps |
| On-chain deployment (`newTokenV5`) | ✅ Done | Vanity salt (8888/7777), BSC Mainnet + Testnet |
| IPFS metadata upload | ✅ Done | `flap.mypinata.cloud`, image auto-save on deploy |
| Token list API (`GET /tokens`) | ✅ Done | Sort: newest, most_used; Filter: ACTIVE/DEPLOYING |
| Token detail API (`GET /tokens/:id`) | ✅ Done | Includes skill + author claim info |
| Launchpad page (card grid + sort tabs) | ✅ Done | Newest / Most Used / Hot / Top Gainers |

### 3.2 Token Detail Page
| Task | Status | Notes |
|------|--------|-------|
| Token header (name, symbol, status, CA) | ✅ Done | Copy address, BscScan link |
| Stats bar (price, mcap, progress, supply) | ✅ Done | On-chain real-time via `getTokenV7` |
| Bonding curve chart (K-line + curve overlay) | ✅ Done | `FlapTokenCirculatingSupplyChanged` events, chunked getLogs |
| Trade panel (buy/sell with preview) | ✅ Done | `swapExactInput`, tax-aware quote |
| Linked Skill card (author, GitHub, stats) | ✅ Done | Description, install cmd, stars, downloads, language |
| Tax allocation display | ✅ Done | Dev Fund / Burn / Dividends / Liquidity breakdown |
| Subscript price format (not scientific notation) | ✅ Done | `0.0₈5564` style |

### 3.3 Author Verification & Revenue
| Task | Status | Notes |
|------|--------|-------|
| AuthorClaim model (Prisma) | ✅ Done | One claim per skill, VERIFIED/REVOKED status |
| GitHub OAuth access token storage | ✅ Done | Stored on login, refreshed each session |
| GitHub repo permission verification | ✅ Done | `GET /repos/{owner}/{repo}` → check `permissions.push` |
| Author claim API (`POST /author-claims`) | ✅ Done | Verifies GitHub write access |
| Beneficiary wallet setting | ✅ Done | `PUT /author-claims/:id/beneficiary` |
| Verified Author badge (frontend) | ✅ Done | Green shield on skill card + detail page |
| Claim button (frontend) | ✅ Done | Shows when unclaimed + user has GitHub login |
| Tax revenue display (on-chain) | 📋 Planned | Query TaxProcessor balance or estimate from events |
| On-chain beneficiary transfer | 📋 Planned | Requires TaxProcessor ABI |

### 3.4 Platform Economy
| Task | Status | Notes |
|------|--------|-------|
| Token launch fee (0.005 BNB) | ✅ Done | Sent to treasury before deployment |
| Comment system on token pages | ✅ Done | Rate limited (5/min), pump.fun style |
| Recent Trades feed (token detail) | ✅ Done | From `FlapTokenCirculatingSupplyChanged` events |
| Global activity feed (landing page) | ✅ Done | Scrolling marquee: launches + comments |
| Skill↔Token bidirectional discovery | ✅ Done | Token price banner on skill page, $SYMBOL badge on marketplace |
| Wallet address display in navbar | ✅ Done | Icon + `0x1234...5678` format, click to copy |

### 3.5 Planned
| Task | Status | Notes |
|------|--------|-------|
| Token ranking with on-chain snapshots | 📋 Planned | Cron job for price/volume history |
| Token holder tracking | 📋 Planned | On-chain event indexing |
| Milestone system (download-based rewards) | 💡 Idea | See LAUNCHPAD.md |
| DEX graduation tracking | 📋 Planned | `LaunchedToDEX` event listener |
| User profile pages | 📋 Planned | Skills, tokens, claims |
| Notification system | 📋 Planned | Trade alerts, comments, price changes |
| Points/gamification system | 💡 Idea | SafuPoints for engagement |

---

## Phase 4: User Dashboard & Analytics — 🔧 Partial

### 4.1 Dashboard UI
| Task | Status | Notes |
|------|--------|-------|
| Dashboard layout (sidebar + main) | ✅ Done | 260px sidebar |
| Stats grid (downloads, skills, revenue, score) | ✅ Done | Static values |
| My Published Skills table | ✅ Done | Links to skill detail |
| Recent Activity feed | ✅ Done | Static mock data |
| Revenue chart placeholder | ✅ Done | Empty chart area |

### 4.2 Dashboard Backend
| Task | Status | Notes |
|------|--------|-------|
| User stats API (total downloads, skill count) | 📋 Planned | Aggregate queries |
| Activity log model + API | 📋 Planned | Track user events |
| Revenue tracking API | 📋 Planned | Depends on token launch |
| Real-time notifications | 📋 Planned | WebSocket or SSE |

---

## Phase 5: Enhanced Marketplace — 📋 Planned

| Task | Status | Notes |
|------|--------|-------|
| Skill versioning (upload new version) | 📋 Planned | Version history in DB |
| Skill reviews & ratings | 📋 Planned | Model + UI exists as placeholder |
| Skill search (full-text) | 📋 Planned | Current search is client-side name filter |
| Skill tags / labels | 📋 Planned | Multi-tag filtering |
| Trending / popular skills algorithm | 📋 Planned | Based on downloads + recency |
| Skill collections / curated lists | 💡 Idea | |
| Skill dependency graph | 💡 Idea | Show which skills compose together |
| Skill preview / sandbox | 💡 Idea | Run skill in isolated env |

---

## Phase 6: Developer Experience — 📋 Planned

| Task | Status | Notes |
|------|--------|-------|
| CLI tool (`safuskill publish`) | 📋 Planned | Publish from terminal |
| SDK for skill development | 📋 Planned | TypeScript + Python |
| Skill template scaffolding | 📋 Planned | `safuskill init` |
| API key management | 📋 Planned | For programmatic access |
| Webhook notifications | 📋 Planned | Scan complete, new download, etc. |
| Developer documentation site | 📋 Planned | Guides, tutorials, API ref |

---

## Phase 7: Security & Compliance — 🔧 Partial

| Task | Status | Notes |
|------|--------|-------|
| GoPlus AgentGuard scan on upload | ✅ Done | Automated |
| Risk level display (LOW–CRITICAL) | ✅ Done | Badges + detail cards |
| Scan detail breakdown (5 categories) | ✅ Done | Malicious code, data leak, etc. |
| Continuous re-scanning (on schedule) | 📋 Planned | Re-scan existing skills periodically |
| Community-driven security reports | 📋 Planned | User-submitted vulnerability reports |
| Skill sandboxing / isolation | 📋 Planned | Containerized execution |
| Audit trail / compliance log | 📋 Planned | Immutable scan history |
| On-chain security attestation | 💡 Idea | Publish scan results to BNBChain |

---

## Phase 8: Social & Community — 📋 Planned

| Task | Status | Notes |
|------|--------|-------|
| User profiles (public page) | 📋 Planned | Show published skills + stats |
| Follow developers | 📋 Planned | |
| Skill comments / discussions | 📋 Planned | |
| Leaderboard (top creators) | 📋 Planned | By downloads, revenue, ratings |
| Referral / affiliate program | 💡 Idea | |
| DAO governance for marketplace curation | 💡 Idea | Token-weighted voting |

---

## Phase 9: Infrastructure & Ops — 🔧 Partial

| Task | Status | Notes |
|------|--------|-------|
| Docker Compose deployment | ✅ Done | Single-command deploy |
| Prisma migrations | ✅ Done | Version-controlled schema |
| CORS configuration | ✅ Done | Dev + production |
| Static file serving (production) | ✅ Done | NestJS serves frontend build |
| Health check endpoint | 📋 Planned | `GET /api/health` |
| Rate limiting | 📋 Planned | Per-IP and per-user |
| Request logging / monitoring | 📋 Planned | Structured logs |
| CI/CD pipeline | 📋 Planned | GitHub Actions |
| CDN for static assets | 📋 Planned | |
| Database backups | 📋 Planned | Automated MySQL dumps |
| Horizontal scaling | 💡 Idea | Stateless backend + shared storage |

---

## Summary

| Phase | Status | Completion |
|-------|--------|------------|
| Phase 1: Core Platform | ✅ Complete | 100% |
| Phase 2: BNBChain Integration | ✅ Complete | 100% |
| Phase 3: Token Launchpad | 🔧 In Progress | ~90% (core + economy + social done, rankings + holders planned) |
| Phase 4: Dashboard & Analytics | 🔧 Partial | ~40% (UI done, backend planned) |
| Phase 5: Enhanced Marketplace | 📋 Planned | 0% |
| Phase 6: Developer Experience | 📋 Planned | 0% |
| Phase 7: Security & Compliance | 🔧 Partial | ~40% (core scanning done) |
| Phase 8: Social & Community | 📋 Planned | 0% |
| Phase 9: Infrastructure & Ops | 🔧 Partial | ~30% |
