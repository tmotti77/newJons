# Fast Lane (working title)

A modern, mobile, live-multiplayer spiritual successor to *Jones in the Fast Lane*.
Full spec: [`docs/DEV_PLAN.md`](docs/DEV_PLAN.md). Agent instructions: [`CLAUDE.md`](CLAUDE.md) / [`AGENTS.md`](AGENTS.md).

## Status

**Phase 0 — Foundations** (in progress). See `docs/DEV_PLAN.md` §6 for the phase checklist.

## Stack

Expo React Native + TypeScript (client), Supabase (Postgres, Realtime, Edge Functions, Auth),
pure deterministic TS game engine, pnpm monorepo.

## Getting started

```sh
pnpm install
pnpm test        # engine + shared unit tests
pnpm typecheck
cd apps/mobile && pnpm start   # Expo dev server
```

## Layout

- `apps/mobile` — Expo app (expo-router)
- `packages/engine` — pure deterministic game engine (Phase 1)
- `packages/shared` — zod schemas shared client/server
- `supabase/` — migrations + edge functions
- `docs/` — dev plan + ADRs
