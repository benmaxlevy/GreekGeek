# Rally

pnpm + Turborepo monorepo: NestJS API (`apps/api`) and Vite React web app (`apps/web`).

## Requirements

- Node **22.21.1** (see `.nvmrc`) — use nvm: `nvm use`
- [pnpm](https://pnpm.io) via Corepack: `corepack enable`
- Docker Desktop with **WSL integration** enabled (for Postgres)

## Quick start

```bash
nvm use
corepack enable
pnpm install
# If pnpm blocks native builds (prisma/esbuild): pnpm approve-builds --all && pnpm install
cp .env.example apps/api/.env
```

### Database (Docker)

Docker is required for Postgres. If `docker` is missing in WSL:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on Windows
2. Settings → Resources → WSL Integration → enable your distro
3. Restart the WSL shell, then:

```bash
docker compose up -d
pnpm db:generate
pnpm db:migrate
pnpm db:seed
```

Seeded admin: `admin@rally.local` / `RallyAdmin123!`

### Dev servers

```bash
pnpm dev
```

- API health: http://localhost:3001/api/health
- Auth: http://localhost:3001/api/auth/{signup,login,refresh,logout,me}
- Web: http://localhost:5173 (proxies `/api` → API)
- Login UI: http://localhost:5173/login
- Signup UI: http://localhost:5173/signup

## Workspace layout

```
apps/api          NestJS + Prisma
apps/web          Vite + React 19 + TanStack Router/Query + Tailwind v4
packages/contracts  Shared Zod schemas + types
packages/tsconfig   Shared TypeScript bases
```

## Scripts

| Command | Description |
| --- | --- |
| `pnpm dev` | Start API + web via Turbo |
| `pnpm build` | Build all packages/apps |
| `pnpm typecheck` | Typecheck all workspaces |
| `pnpm db:generate` | Prisma client generate |
| `pnpm db:migrate` | Prisma migrate (dev) |
| `pnpm db:studio` | Prisma Studio |

## Phase status

Phase 1 (repo setup) is in place. Theme port and auth land in Phase 2.
