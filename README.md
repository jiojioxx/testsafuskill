# SafuSkill

**The Secure Marketplace for AI Agent Skills**

SafuSkill is a Web3-powered marketplace where developers discover, publish, and trade AI Agent Skills with built-in security scanning. Every skill is automatically audited by [GoPlus AgentGuard](https://gopluslabs.io/) before it reaches users. Skill creators can launch ERC-20 Skill Tokens on BNBChain to monetize their work.

![SafuSkill](packages/frontend/public/og-image.png)

---

## Features

- **Skill Marketplace** — Browse, search, and download AI agent skills across categories (BNBChain Skills, Code Gen, Security, Data Analysis, DevOps)
- **GoPlus Security Scanning** — Every uploaded skill is automatically scanned for malicious code, data leakage, unauthorized network requests, shell access, and file system abuse
- **BNBChain Skill Crawler** — Automatically syncs skills from official BNBChain GitHub repos ([bnb-chain/bnbchain-skills](https://github.com/bnb-chain/bnbchain-skills), [binance/binance-skills-hub](https://github.com/binance/binance-skills-hub)) every 6 hours
- **Token Launchpad** — Launch Skill Tokens (BEP-20) to monetize your AI skills on BNBChain
- **Multi-Auth** — Sign in with Email, GitHub, or Ethereum Wallet (SIWE)
- **Developer Dashboard** — Track downloads, security scores, and token revenue

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | NestJS, Prisma ORM, MySQL |
| Auth | JWT, Passport (GitHub OAuth), SIWE (Wallet) |
| Security | GoPlus AgentGuard |
| Web3 | Wagmi, Viem, BNBChain |
| State | Zustand, TanStack Query |
| Deploy | Docker Compose |

---

## Quick Start

### Prerequisites

- Node.js 18+
- MySQL 8+
- Docker & Docker Compose (optional)

### Development

```bash
# Clone and install
git clone https://github.com/your-org/safuskill.git
cd safuskill
npm install

# Set up environment
cp packages/backend/.env.example packages/backend/.env
# Edit .env with your database URL, JWT secret, etc.

# Start database
docker-compose up db -d

# Run migrations
cd packages/backend
npx prisma migrate dev
npx prisma db seed
cd ../..

# Start backend (http://localhost:3000)
npm run backend

# Start frontend (http://localhost:5173)
npm run frontend
```

### Production (Docker)

```bash
# Configure environment
cp .env.example .env
# Edit .env with production values

# Build and start
docker-compose up -d --build

# Run migrations
docker-compose exec app npx prisma migrate deploy \
  --schema=./packages/backend/prisma/schema.prisma
```

The app serves on port **3000** — backend API at `/api/*`, frontend SPA on all other routes.

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `DATABASE_URL` | Yes | MySQL connection string |
| `JWT_SECRET` | Yes | Secret key for JWT signing |
| `JWT_EXPIRES_IN` | No | Token expiry (default: `7d`) |
| `GITHUB_CLIENT_ID` | Yes | GitHub OAuth app client ID |
| `GITHUB_CLIENT_SECRET` | Yes | GitHub OAuth app client secret |
| `GITHUB_TOKEN` | No | GitHub PAT for crawler (avoids rate limits) |
| `RESEND_API_KEY` | No | Resend.com API key for email verification |
| `RESEND_FROM_EMAIL` | No | Sender email address |
| `CORS_ORIGINS` | No | Allowed origins (default: `http://localhost:5173`) |
| `FRONTEND_URL` | No | Frontend URL for OAuth redirects |
| `PORT` | No | Server port (default: `3000`) |

---

## Project Structure

```
safuskill/
├── packages/
│   ├── frontend/                 # React SPA
│   │   ├── src/
│   │   │   ├── pages/           # 9 page components
│   │   │   ├── components/      # Shared components (Navbar, Footer, Logo)
│   │   │   ├── store/           # Zustand auth store
│   │   │   ├── lib/             # API client, Wagmi config
│   │   │   └── index.css        # Design system (CSS variables + animations)
│   │   ├── public/              # Static assets, favicons, OG image
│   │   └── tailwind.config.js
│   └── backend/                  # NestJS API
│       ├── src/
│       │   └── modules/
│       │       ├── auth/        # Email, GitHub, Wallet auth
│       │       ├── users/       # User CRUD
│       │       ├── skills/      # Skill CRUD + category filtering
│       │       ├── scan/        # GoPlus AgentGuard integration
│       │       ├── github-sync/ # BNBChain repo crawler (6h cron)
│       │       └── common/      # Prisma, Email, decorators
│       └── prisma/
│           └── schema.prisma    # Database schema
├── doc/
│   ├── API-Documentation.md     # REST API reference
│   ├── UI-Design-Guide.md       # UI specification & design system
│   └── Development-Roadmap.md   # Feature status & roadmap
└── docker-compose.yml
```

---

## API Overview

All endpoints are prefixed with `/api`. See [API Documentation](doc/API-Documentation.md) for full details.

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| POST | `/auth/send-code` | No | Send email verification code |
| POST | `/auth/verify-code` | No | Verify code and get JWT |
| GET | `/auth/github` | No | GitHub OAuth redirect |
| GET | `/auth/wallet/nonce` | No | Get SIWE nonce |
| POST | `/auth/wallet/login` | No | Wallet signature login |
| GET | `/users/me` | Yes | Get current user profile |
| GET | `/skills` | No | List skills (paginated, filterable) |
| GET | `/skills/:id` | No | Get skill details + scan result |
| POST | `/skills` | Yes | Upload skill (.zip) |
| GET | `/skills/:id/download` | No | Download skill file |
| DELETE | `/skills/:id` | Yes | Delete own skill |
| GET | `/scan/:skillId` | No | Get scan result |

---

## Documentation

- [API Documentation](doc/API-Documentation.md) — REST API endpoints and response schemas
- [UI Design Guide](doc/UI-Design-Guide.md) — Colors, typography, components, layout specifications
- [Development Roadmap](doc/Development-Roadmap.md) — Feature status and planned work

---

## Security

SafuSkill uses [GoPlus AgentGuard](https://gopluslabs.io/) to scan every skill for:

| Check | Description |
|-------|-------------|
| Malicious Code | Detects harmful code patterns and known exploits |
| Data Leakage | Identifies unauthorized data exfiltration attempts |
| Network Requests | Flags suspicious outbound connections |
| Shell Access | Detects unauthorized system command execution |
| File System | Monitors for dangerous file system operations |

Each skill receives a risk level: **LOW**, **MEDIUM**, **HIGH**, or **CRITICAL**.

---

## License

MIT

---

## Links

- **BNBChain Skills**: [github.com/bnb-chain/bnbchain-skills](https://github.com/bnb-chain/bnbchain-skills)
- **Binance Skills Hub**: [github.com/binance/binance-skills-hub](https://github.com/binance/binance-skills-hub)
- **GoPlus Security**: [gopluslabs.io](https://gopluslabs.io/)
