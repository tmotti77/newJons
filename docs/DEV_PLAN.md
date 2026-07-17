# FAST LANE (working title) — Full Development Plan

**A modern, mobile, live-multiplayer spiritual successor to _Jones in the Fast Lane_ (Sierra, 1990).**

This document is the single source of truth for the project. It is written so that AI coding agents (Claude Code, Codex) can execute it phase by phase. Every phase has concrete tasks and acceptance criteria. Keep this file in the repo at `/docs/DEV_PLAN.md` and update it as decisions change.

---

## 0. TL;DR

- **What:** A satirical "life sim as competitive board game." 2–8 friends on their own phones race to hit life goals (Money / Happiness / Education / Career) over simulated "weeks."
- **How it plays:** Simultaneous turns. Every round = one in-game week. Everyone plans their week at the same time in a 90-second window, then a shared **Reveal** screen shows what happened to everyone (rent hikes, robberies, promotions, drama). 15–20 minute sessions.
- **Modes (in order of shipping):** 1) Live with friends (room code, Among Us style) → 2) Async (24h turns, notifications) → 3) Solo vs AI bot.
- **Stack:** Expo React Native + TypeScript (client), Supabase (Postgres, Realtime, Edge Functions, Auth), shared pure-TS deterministic game engine in a monorepo.
- **Golden rule:** The game engine is a pure, deterministic, fully-tested TypeScript package that knows nothing about UI, networking, or Supabase. The server is authoritative; clients only predict.

---

## 1. Vision & Product Definition

### 1.1 Elevator pitch
"Among Us meets BitLife meets Monopoly." A chaotic, funny race through modern adult life: work shifts, take courses, pay rent, buy dumb gadgets, gamble on crypto, and try to hit your life goals before your friends do — while the game roasts everyone at the end of each week.

### 1.2 Design pillars (every feature must serve at least one)
1. **Friend drama.** The game creates conversation. Reveal screens name names ("Dana blew ₪400 at the club and missed rent").
2. **Short & simultaneous.** No one ever waits watching someone else's turn. Rounds are parallel; total session 15–20 min.
3. **Meaningful tradeoffs.** Time is the real currency. Every week you can't do everything — work vs. study vs. fun vs. life admin.
4. **Satire of modern life.** Gig apps, rent hikes, crypto pumps, subscription creep, hustle culture. Funny, not preachy.
5. **Zero-friction entry.** No account required to play. Tap link / enter room code → pick name & avatar → playing in 30 seconds.

### 1.3 Target
- Primary: friend groups 18–35, game nights, Discord groups, family (the original Jones audience grown up + their kids).
- Session: 15–20 min live. Player count: 2–8 (sweet spot 3–5).
- Platforms: iOS + Android (single Expo codebase). Tablet supported but phone-first.

### 1.4 Legal / IP (important)
- **Do NOT** use the name "Jones in the Fast Lane," its characters, art, sounds, or text. The IP belongs to Activision/Microsoft.
- Game mechanics themselves are not copyrightable — a "life sim board game" with original theme, names, art, and writing is fine.
- All location names, item names, characters, and jokes in this doc are original placeholders. Pick a final name before store submission (check trademark + domain + app store collisions). Working title: **Fast Lane** internally, repo codename `fastlane`.

---

## 2. Game Design Document (GDD)

### 2.1 Core loop (one round = one in-game "week")
1. **Plan phase (default 90s, configurable 60/90/120):** Each player, on their own screen, spends their weekly **Time Units (TU)** on actions: travel, work, study, shop, eat, bank, fun. UI shows a live plan being built; players can reorder/undo until they hit **Submit** or the timer ends.
2. **Resolve (server, ~1s):** Server validates all plans, runs the deterministic engine with the game seed, applies random events.
3. **Reveal phase (15–20s, auto-advances):** Shared, synchronized "week recap": per-player highlights, event cards, standings, roast lines. This is the social payoff — make it juicy.
4. Next week starts. First player to hit **all four goals** wins (see 2.7). Hard cap: configurable max weeks (default 30) → highest weighted score wins.

### 2.2 Player resources
| Resource | Range | Notes |
|---|---|---|
| **Cash** | ₪/$/coins ≥ 0 | On-hand cash (robbable) vs bank balance (safe, earns interest). |
| **Happiness** | 0–100 | Decays -3/week baseline. Raised by fun, goods, nice apartment. Below 20 → "burnout": -25% wages. |
| **Education** | 0–12 courses + degree | Courses unlock job tiers. 3 tracks (Business / Tech / Trade) for flavor. |
| **Career** | Tier 0–6 | Current job. Requires education + experience weeks + dress code. |
| **Time Units** | 60 / week | The core constraint. Unspent TU auto-converts to "rest" (+2 happiness). |
| **Health/Hunger** | fed / hungry | Must buy food weekly (₪30, or cheaper in bulk with a fridge) or: -15 happiness, -10% wages next week. |

### 2.3 The town (locations)
Town is a stylized map. Travel between locations costs TU (adjacent 2 TU, across town 4 TU; bike -1, car -2, min 1). All names are placeholders — keep them in a config file for easy rewrites/localization.

| Location | Placeholder name | What you do there |
|---|---|---|
| Fast food job | **Burger Barn** | Work shifts (T1–T2 jobs), buy cheap meals. |
| Gig economy app | **GigBoard** (accessible from anywhere via phone item) | T0 odd jobs, no requirements, low pay. |
| University | **City College** | Take courses (₪50 + 10 TU each). Degree at 12 courses. |
| Electronics store | **Gadget City** | Phone, TV, console, fridge, laptop (laptop = online courses at home, -2 TU per course). |
| Secondhand / pawn | **Flip It** | Sell items at 50%, buy used items at 70% price, occasional rare deals. |
| Clothing store | **Dress Code** | Casual / Business / Luxury outfits. Required for job tiers. Wear out after 8 weeks. |
| Employment agency | **CareerHub** | Apply for T2+ jobs, see requirements, interviews (1 visit + dress check). |
| Bank & exchange | **Coin & Bank** | Deposit/withdraw (safe from robbery), 1%/week interest, **CryptoRocket** volatile asset (±40%/wk, seeded). |
| Supermarket | **QuickMart** | Weekly food, bulk food (needs fridge), lottery tickets (₪5, jackpot ₪2,000, odds 1/500). |
| Nightlife / fun | **The Spot** | Club night ₪40 → +10 happiness. Movie ₪25 → +6. |
| Landlord | **Rent-A-Lord** | Pay rent, upgrade/downgrade apartment. |
| Home | **Your apartment** | Rest (+happiness), use owned goods, online courses w/ laptop, order delivery (food +₪10). |

### 2.4 Housing & rent (the villain of the game)
- Tiers: **Roach Towers** ₪80/wk (+0 happiness) → **Midtown Flat** ₪160/wk (+3/wk) → **Skyline Lofts** ₪320/wk (+8/wk).
- Rent is auto-charged at week resolve. Insufficient funds → **Late notice** (-10 happiness). Two consecutive misses → **evicted** to the Shelter (-20 happiness, must re-deposit to rent again).
- Global rent hikes: +5% every 4 weeks + random "market heat" events. Everyone suffers together — great reveal-screen content.

### 2.5 Jobs & career ladder (placeholder balance v0.1 — all values live in `packages/engine/src/config/balance.ts`)
| Tier | Job | Wage/TU | Requirements |
|---|---|---|---|
| T0 | Gig tasks | ₪8 | None |
| T1 | Burger Barn crew | ₪10 | Apply in person |
| T2 | Shift lead | ₪14 | 2 courses + 3 weeks worked |
| T3 | Office assistant | ₪18 | 4 courses + Business attire |
| T4 | Junior developer | ₪26 | 8 courses (Tech) + laptop |
| T5 | Manager | ₪32 | 10 courses + 8 weeks worked + Business attire |
| T6 | Executive | ₪45 | Degree (12) + 12 weeks worked + Luxury attire |
- Working: choose shift length in TU (min 4, max 40/week). Promotions require applying at CareerHub when eligible.
- Random wage events: overtime bonus, shift cancelled, viral tip jar, layoffs (T3+ small chance during "recession" event).

### 2.6 Random events (resolved server-side from seed, shown as cards on Reveal)
Categories: **Personal** (robbery if carrying >₪500 cash: 10%/wk lose half; sickness if hungry; found wallet; phone broke), **Economy** (crypto pump/dump, rent surge, sale at Gadget City, recession), **Social** (roast lines comparing players, "player X and Y were seen at The Spot"), **Jackpot** (lottery win). Target: 1–2 events per player per week max; weight config in balance file.

### 2.7 Win condition
At game creation, host sets goal preset (or custom sliders):
- **Quick (15 min):** ₪2,000 net worth · 70 happiness · 4 courses · Career T3
- **Classic (25 min):** ₪6,000 · 80 · 8 courses · T4
- **Marathon:** ₪15,000 · 85 · Degree · T6
First player to satisfy **all four at end of a week** wins. Tie in same week → higher total weighted score. Week cap reached → weighted score: `netWorth/goal + happiness/goal + courses/goal + tier/goal` (equal weights v1).

### 2.8 Modes
- **Live (SHIPS FIRST):** room code lobby, presence, synced 90s rounds, synced reveal. Host controls settings + start + kick.
- **Async (Phase 7):** same engine; round deadline 24h (configurable); resolve when all submitted or deadline hits (AFK = auto-rest); push notification on reveal. Multiple concurrent games per user.
- **Solo vs AI (Phase 8):** 1–3 heuristic bots ("Jones" archetypes: The Grinder, The Gambler, The Party Animal) running a scripted policy over the same engine. Doubles as tutorial.

### 2.9 Onboarding & tutorial
- First launch: 60-second interactive "plan one week" mini-tutorial (no reading walls). Skippable.
- Contextual tooltips first time each location is opened. "?" button on every screen → 1-paragraph help.

### 2.10 Tone, art & audio direction
- Art: flat, bold, slightly grotesque cartoon characters (think *Gartic Phone* / *BitLife* energy), bright colors, big readable numbers. Town = single stylized map screen with tappable buildings.
- 8 preset avatars at launch (mix-and-match head/color unlockables later).
- Writing: dry, roasting, localized properly (see 5.8 — Hebrew + English from day 1, RTL support).
- Audio: light lo-fi/funk loop in lobby, tick-tock during last 10s of planning, punchy stingers on reveal cards. All toggleable.

---
## 3. Technical Architecture

### 3.1 Stack decision (final)
| Layer | Choice | Why |
|---|---|---|
| Client | **Expo React Native + TypeScript** | Single codebase iOS/Android, your existing expertise, OTA updates via EAS Update. |
| Backend | **Supabase** | Postgres + Realtime channels + Edge Functions + Auth (anonymous) + cron. No dedicated game servers needed for turn-based. |
| Game logic | **Pure TS engine package** | Shared client/server, deterministic, unit-testable, no runtime deps. |
| State (client) | **Zustand** (game/UI state) + **TanStack Query** (server data) | Simple, no boilerplate. |
| Validation | **Zod** schemas in `packages/shared` | Same schemas validate on client (UX) and edge functions (authority). |
| Testing | **Vitest** (engine, shared), **Playwright/Maestro** later for E2E | Engine coverage is the priority. |
| CI/CD | **GitHub Actions** + **EAS Build/Submit/Update** | Standard Expo pipeline. |
| Analytics/crash | **PostHog** + **Sentry** | Both have free tiers + RN SDKs. |

### 3.2 Monorepo layout (pnpm workspaces)
```
fastlane/
├── apps/
│   └── mobile/                 # Expo app
│       ├── app/                # expo-router screens
│       ├── src/
│       │   ├── components/
│       │   ├── features/       # lobby/, planning/, reveal/, town/
│       │   ├── stores/         # zustand
│       │   ├── lib/            # supabase client, realtime hooks
│       │   └── i18n/           # en.json, he.json
│       └── assets/
├── packages/
│   ├── engine/                 # PURE game logic. No imports from RN/Supabase. 100% deterministic.
│   │   └── src/
│   │       ├── config/balance.ts      # ALL tunable numbers live here
│   │       ├── types.ts               # GameState, PlayerState, Action, WeekResult, EventCard
│   │       ├── validate.ts            # validatePlan(state, actions): ValidationResult
│   │       ├── resolve.ts             # resolveWeek(state, plansByPlayer, seed): WeekResult
│   │       ├── rng.ts                 # seeded PRNG (mulberry32 or similar)
│   │       ├── events.ts              # event tables + weights
│   │       ├── goals.ts               # win-condition checks + scoring
│   │       └── bots/                  # Phase 8: heuristic policies
│   └── shared/                 # zod schemas, API request/response types, constants
├── supabase/
│   ├── migrations/             # SQL, one file per change
│   ├── functions/              # edge functions (Deno)
│   │   ├── create-game/
│   │   ├── join-game/
│   │   ├── start-game/
│   │   ├── submit-plan/
│   │   ├── resolve-round/
│   │   └── rejoin-game/
│   └── seed.sql
├── docs/
│   ├── DEV_PLAN.md             # this file
│   └── decisions/              # ADRs: short markdown per big decision
├── CLAUDE.md                   # agent instructions (see §8)
├── AGENTS.md                   # same content for Codex
└── .github/workflows/ci.yml
```

### 3.3 The authority model (read this twice)
- **Server is authoritative.** Clients send *plans* (intent), never results. The `resolve-round` edge function is the ONLY code path that mutates game state.
- **Engine is deterministic.** `resolveWeek(state, plans, seed)` → same inputs always produce identical outputs. All randomness flows from the per-game seed + round number (`rng(seed, round, playerIndex)`), never `Math.random()`.
- **Clients predict, server decides.** The client runs `validatePlan` locally for instant feedback (grey out unaffordable actions, show projected cash), but the reveal renders ONLY what the server returned.
- **Idempotency.** `resolve-round` takes `(game_id, round_number)` and uses a Postgres advisory lock + status check so double-invocation is a no-op.

### 3.4 Round timing (live mode)
- On round start, server writes `rounds.ends_at = now() + interval '90 seconds'`. Clients render countdown from that timestamp (never local timers as truth).
- Resolution triggers, whichever first: (a) `submit-plan` detects all players submitted → invokes resolve; (b) any client observing `ends_at` passed calls `resolve-round` (idempotent, so N clients calling is safe); (c) safety net: scheduled function every 60s sweeps for expired unresolved rounds (covers "everyone backgrounded the app").
- Players who didn't submit: engine substitutes `auto-rest` plan (pay rent, eat if affordable, rest).
- Reveal is synchronized by timestamp too: `reveal_until = resolved_at + 18s`, then clients locally advance to next round which the resolve function already created.

### 3.5 Realtime & presence
- One Supabase Realtime channel per game: `game:{game_id}`.
  - **Presence:** who's connected (lobby avatars, "reconnecting…" badges in game).
  - **Postgres changes** on `games`, `rounds`, `round_results` filtered by `game_id` → clients react to state transitions (started, resolved).
- Nothing gameplay-critical rides on broadcast alone; DB rows are truth, realtime is just the doorbell. On any reconnect, client refetches full state (§3.7).

### 3.6 Auth & identity
- **Anonymous auth** (Supabase `signInAnonymously`) on first launch → instant play, `profiles` row with display name + avatar.
- Optional later: link email/Apple/Google to keep stats across devices. Not in MVP.

### 3.7 Reconnection (a first-class feature, not an afterthought)
- App foreground/`AppState` change or channel rejoin → `rejoin-game` returns the complete current snapshot: game, players, current round, my submitted plan (if any), `ends_at`.
- Client store has a single `hydrateFromSnapshot()` path used by BOTH initial join and every reconnect — one code path, fewer bugs.
- Killed app: last `game_id` persisted in AsyncStorage → "Return to your game?" banner on launch while game status is active.
- Player disconnected during planning: their submitted plan stands; if none, auto-rest. Game never blocks on a disconnected player.

### 3.8 Database schema (v1)
```sql
-- profiles: 1 row per auth user
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 1 and 20),
  avatar text not null default 'a1',
  created_at timestamptz not null default now()
);

create type game_status as enum ('lobby','active','finished','abandoned');
create type game_mode as enum ('live','async','solo');

create table games (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,              -- 5-char A-Z room code, generated server-side
  status game_status not null default 'lobby',
  mode game_mode not null default 'live',
  host_id uuid not null references profiles(id),
  settings jsonb not null,                -- goal preset, timer length, max weeks, etc. (zod-validated)
  seed bigint not null,                   -- game RNG seed
  current_round int not null default 0,
  winner_id uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table game_players (
  game_id uuid references games(id) on delete cascade,
  player_id uuid references profiles(id),
  slot int not null,                      -- 0..7, stable ordering & RNG lane
  state jsonb not null,                   -- full PlayerState (engine-owned shape)
  is_connected boolean not null default true,
  last_seen timestamptz not null default now(),
  primary key (game_id, player_id),
  unique (game_id, slot)
);

create type round_status as enum ('planning','resolved');

create table rounds (
  game_id uuid references games(id) on delete cascade,
  round_number int not null,
  status round_status not null default 'planning',
  starts_at timestamptz not null default now(),
  ends_at timestamptz not null,
  resolved_at timestamptz,
  primary key (game_id, round_number)
);

create table round_plans (
  game_id uuid,
  round_number int,
  player_id uuid references profiles(id),
  plan jsonb not null,                    -- ordered Action[] (zod-validated)
  submitted_at timestamptz not null default now(),
  primary key (game_id, round_number, player_id),
  foreign key (game_id, round_number) references rounds(game_id, round_number) on delete cascade
);

create table round_results (
  game_id uuid,
  round_number int,
  results jsonb not null,                 -- WeekResult: per-player deltas, event cards, standings
  primary key (game_id, round_number),
  foreign key (game_id, round_number) references rounds(game_id, round_number) on delete cascade
);
```
- **RLS:** enabled on everything. Players can `select` rows only for games they're in; **all writes go through edge functions** (service role). Room-code join: `join-game` function looks up by code with service role, so `games` needs no public select-by-code policy.
- **Retention:** cron marks `lobby` games older than 2h and `active` games idle 24h (live mode) as `abandoned`; hard-delete abandoned/finished games after 30 days.

### 3.9 Edge functions (API surface, all POST, all zod-validated)
| Function | Input | Behavior |
|---|---|---|
| `create-game` | settings | Create game + host player row, generate unique code + seed. → `{game_id, code}` |
| `join-game` | code, display_name, avatar | Validate lobby not full (8) / status=lobby; upsert profile; add player. → snapshot |
| `start-game` | game_id | Host-only. Requires ≥2 players. Init PlayerStates from balance config, create round 1, status→active. |
| `submit-plan` | game_id, round, plan[] | Validate with engine `validatePlan` against player state. Store. If all submitted → invoke resolve. |
| `resolve-round` | game_id, round | Idempotent (advisory lock). Load plans (fill auto-rest), run `resolveWeek`, write `round_results`, update `game_players.state`, check goals → maybe finish game, else create next round. |
| `rejoin-game` | game_id | Return full snapshot for hydration. |
| `leave-game` / `kick-player` | game_id, (player_id) | Lobby: remove. Active: mark abandoned-player (auto-rest thereafter). Host migration if host leaves lobby. |

### 3.10 Engine action model
```ts
type Action =
  | { type: 'travel'; to: LocationId }
  | { type: 'work'; tu: number }                    // at current job's location
  | { type: 'study'; courseTrack: Track }            // college or home(laptop)
  | { type: 'buy'; item: ItemId }                    // context: current location
  | { type: 'sell'; item: ItemId }                   // at Flip It
  | { type: 'eat'; kind: 'basic'|'bulk'|'delivery' }
  | { type: 'bank'; op: 'deposit'|'withdraw'; amount: number }
  | { type: 'crypto'; op: 'buy'|'sell'; amount: number }
  | { type: 'lottery'; tickets: number }
  | { type: 'fun'; kind: 'club'|'movie'|'stream' }
  | { type: 'payRent' } | { type: 'moveApartment'; tier: 0|1|2 }
  | { type: 'applyJob'; jobId: JobId }
  | { type: 'rest'; tu: number };
```
- A plan is an **ordered** `Action[]`. Validation simulates sequentially: location context, TU budget (≤60), cash never <0 mid-plan. Invalid plan → reject with per-action error (client shows inline).
- `resolveWeek` output `WeekResult`: per-player `{stateBefore, stateAfter, ledger[], eventCards[]}` + `standings` + `goalProgress` + `winnerId?`. Ledger lines power the reveal screen text.

---
## 4. Client Application Spec

### 4.1 Screen map (expo-router)
```
/                     Home: logo, "Create game", "Join with code", "How to play", settings gear
/setup                First-run: pick name + avatar (persisted)
/create               Game settings: goal preset, round timer, max weeks, player cap → creates & routes to lobby
/join                 6-key code entry (big keys, paste support) → lobby
/game/[id]/lobby      Avatars w/ presence, room code share (share sheet + copy), host: settings recap, Start
/game/[id]/play       THE main screen (see 4.2)
/game/[id]/reveal     Synced week recap: event cards carousel → standings → auto-continue
/game/[id]/over       Winner celebration, final stats board, "Rematch" (new game, same lobby), share result image
/how-to-play          Interactive 60s tutorial
/settings             Language (he/en), sound, haptics, name/avatar, privacy policy, licenses
```

### 4.2 Planning screen (`/game/[id]/play`) — the heart of the game
- **Top bar:** week #, countdown ring (server `ends_at`), players' submit-status dots.
- **Stats strip:** cash, bank, happiness, education, career tier, hunger icon. Tap → detail sheet.
- **Town map (center):** stylized map, tappable buildings. Current location highlighted. Tapping a building opens its **action sheet** (e.g., Burger Barn: work slider in TU, buy meal). Actions append to the plan; travel actions auto-inserted and TU-costed.
- **Plan tray (bottom):** ordered chips of queued actions with TU/₪ costs, drag to reorder, swipe to delete, running totals ("TU left: 14 · projected cash: ₪930"). Invalid states highlight in red before submit.
- **Submit button:** locks plan (can unlock until timer ends). After submit → "waiting" overlay with players' status + fun facts.
- Design principle: **a full week must be plannable in <60 seconds with one thumb.**

### 4.3 Reveal screen choreography (~18s, skippable per-card by tapping)
1. "WEEK 7" splash → 2. Global event card(s) (rent hike / crypto pump) → 3. Per-player highlight cards (biggest earner, biggest waste, robbery victim — 3–5 cards max, engine picks the juiciest via `ledger` heuristics) → 4. Standings with goal-progress bars → 5. Countdown to next week. If someone won: cut to `/over`.

### 4.4 Client state
- `useGameStore` (zustand): snapshot (game, players, round, myPlan draft), hydrated ONLY via `hydrateFromSnapshot()`.
- Engine imported client-side for `validatePlan` + projections. Never for resolution.
- TanStack Query for profile/history; realtime events invalidate/refetch.

### 4.5 Non-functional requirements
- Cold start → in lobby: <5s on mid-range Android. Planning UI 60fps (Reanimated for map/tray).
- Bundle: keep assets lean; lazy-load reveal animations. OTA updates via EAS Update for JS-only fixes.
- Offline: clear "reconnecting" UX; no crashes on airplane mode mid-round (plan kept locally, resubmit on reconnect if round still open).
- Accessibility: dynamic font scaling, color-blind-safe stat colors, haptics toggle.

---

## 5. Cross-cutting Concerns

### 5.1 Localization (day 1: he + en)
- i18next + `react-i18next`; ALL strings in `i18n/*.json` from the first commit (agents: never hardcode UI strings).
- Full **RTL support**: test every screen in Hebrew; icons/flows mirrored via `I18nManager`; numbers stay LTR.
- Event-card copywriting is content, not code: `events.ts` references string keys with params ("{{name}} blew {{amount}} at The Spot").
- Currency symbol is cosmetic per-locale (₪/$); values identical.

### 5.2 Analytics (PostHog) — decide with data, not vibes
Events: `game_created`, `game_joined`, `game_started` (player_count, preset), `plan_submitted` (tu_used, submit_seconds), `round_resolved`, `game_finished` (weeks, duration, winner_goals), `player_dropped`, `rematch`, `tutorial_completed/skipped`, funnel from install→first game. Dashboards: D1/D7 retention, avg session, drop-off round, % games finished.

### 5.3 Crash/error: Sentry on client + edge function logging; alert on resolve-round failures (that's the game-breaking one).

### 5.4 Security & anti-cheat checklist
- All writes via edge functions; RLS denies direct table writes. Zod on every function input.
- Engine re-validates every plan server-side (client validation is UX only).
- Rate limits per user on create/join/submit. Room codes: 5 chars, no ambiguous letters (no O/0/I/1), expire with lobby.
- Profanity filter on display names (he + en lists).

### 5.5 App-store compliance
- Lottery/crypto are fictional, no real money, no purchases of chance → fine, but describe honestly in review notes. Age rating ~12+ (simulated gambling themes). Privacy policy page (required), data collected: anonymous id, analytics. No ads in v1.

### 5.6 Monetization (Phase 9, design now, build later)
Cosmetics only, never pay-to-win: avatar packs, town themes, reveal-card styles, custom roast packs. Free game is fully playable forever.

### 5.7 Performance/scale
Turn-based + Supabase = thousands of concurrent games on modest tiers. Watch: realtime connection limits (1 channel/player), edge function cold starts (keep resolve lean, engine is pure CPU). Load-test resolve with 8-player synthetic games (script in `/scripts`).

---

## 6. Development Phases & Task Breakdown

> Estimates assume ~15–20 focused hrs/week solo + AI agents. Each task should become one agent session / PR. **Do not start a phase before the previous phase's acceptance criteria pass.**

### Phase 0 — Foundations (Week 1)
- [x] Init pnpm monorepo, TS strict everywhere, ESLint+Prettier, Vitest wired in `engine`/`shared`.
- [x] Expo app boots (blank home), expo-router, i18n scaffold with he/en + RTL switch working.
- [x] Supabase project: local dev via CLI, migrations pipeline, first migration = §3.8 schema, RLS on.
- [x] GitHub Actions: typecheck + lint + engine tests on PR. CLAUDE.md + AGENTS.md committed (§8).
- ✅ **Accept:** `pnpm test` green in CI; app runs on a real phone in both languages; `supabase db reset` reproduces schema.

### Phase 1 — Game Engine (Weeks 2–4) ← the soul of the project
- [x] `types.ts`, `balance.ts` (every number from §2 tables), seeded `rng.ts`.
- [x] `validatePlan` with sequential simulation + per-action errors. Exhaustive unit tests (TU overrun, cash underflow, wrong location, dress-code, job requirements).
- [x] `resolveWeek`: wages, rent+eviction, hunger, happiness decay, purchases, bank/crypto/lottery, courses, promotions, event rolls, ledger generation.
- [x] `goals.ts` win checks + week-cap scoring. Event tables + weights.
- [x] **Determinism property test:** 1,000 random games × replay → identical results. Fuzz: random plans never crash/produce negative cash.
- [x] Balance sim script: 10k auto-played games, output weeks-to-win distribution per preset → tune `balance.ts` until Quick ≈ 10–14 weeks.
- ✅ **Accept:** >90% line coverage on engine; determinism + fuzz suites green; sim report committed to `/docs`.

### Phase 2 — Backend (Weeks 5–6)
- [x] Edge functions §3.9 with zod, advisory-locked idempotent resolve, auto-rest fill, timer sweep cron, retention cron.
- [x] Realtime wiring verified (presence + postgres_changes). RLS integration tests (deny direct writes).
- [x] `/scripts/simulate-live-game.ts`: drives 4 fake clients through a full game via functions.
- ✅ **Accept:** script completes full games repeatedly incl. "player never submits" and "double resolve call"; RLS tests green.

### Phase 3 — Client Core Gameplay (Weeks 7–10)
- [ ] Setup/home/create/join/lobby screens, share sheet, presence avatars, host start.
- [ ] Planning screen §4.2 complete with local validation + projections. Reveal §4.3 with synced choreography. Game over + rematch.
- [ ] Reconnection: single `hydrateFromSnapshot` path; AppState resume; return-to-game banner. Ugly-but-clear placeholder art is fine.
- ✅ **Accept:** 4 real phones play a full Quick game start→finish; kill+reopen app mid-round on one phone → seamless rejoin; airplane-mode during planning → recovers.

### Phase 4 — Art, Polish, Feel (Weeks 11–13)
- [ ] Final art: town map, 8 avatars, location sheets, event-card art, animations (Reanimated/Lottie), sound + haptics.
- [ ] Tutorial + contextual help. Full Hebrew pass by a human (you). Empty/edge states, error toasts.
- ✅ **Accept:** a stranger completes tutorial and enjoys a game without asking questions; every screen reviewed in he+en.

### Phase 5 — Closed Beta (Weeks 14–15)
- [ ] EAS: internal distribution → TestFlight + Play Internal. Sentry + PostHog live.
- [ ] 10–20 real testers (friends/family game nights). Weekly balance patches via EAS Update. Bug triage board.
- ✅ **Accept:** ≥30 completed real games; crash-free rate >99%; ≥70% of started games finish; testers ask to play again unprompted (the real metric).

### Phase 6 — Launch (Week 16+)
- [ ] Store listings (he+en screenshots, preview video), privacy policy page, simple landing site, press kit.
- [ ] Staged rollout Android → iOS. Launch playbook: Discord/Reddit (r/tipofmyjoystick nostalgia threads, r/AndroidGaming), Israeli gaming groups, a "play with the dev" night.

### Phase 7 — Async mode · Phase 8 — Solo bots · Phase 9 — Cosmetics
Each gets its own mini-plan when reached; architecture above already accommodates them (mode enum, deadline-based rounds, notifications via Expo Push; bots = policies over engine).

---

## 7. Risks & Mitigations
| Risk | Mitigation |
|---|---|
| Core loop isn't actually fun | Phase 1 sim + paper-prototype a week on real people BEFORE building UI; kill/pivot cheaply. |
| Balance is off (games drag or snowball) | All numbers in one config; sim harness; EAS Update for instant patches. |
| Realtime edge cases (drops, doubles) | Server-authoritative + idempotent resolve + one hydration path + chaos tests in Phase 2/3. |
| IP confusion with Sierra | Original name/art/text; never market as "Jones remake" publicly; "inspired by 90s life sims" is fine. |
| Scope creep (async, bots, shop, chat…) | This doc. Phases are gates. Live mode must be great before anything else. |
| Solo-dev burnout | Agents do the typing; you do design + review. Ship the Quick preset first; everything else is content. |

## 8. Working With Claude Code / Codex

### 8.1 CLAUDE.md / AGENTS.md skeleton (commit in Phase 0)
```md
# Fast Lane — Agent Guide
- Monorepo: pnpm. Run `pnpm i`, `pnpm test`, `pnpm typecheck` before finishing any task.
- packages/engine is PURE TypeScript: no I/O, no Date.now(), no Math.random() (use rng.ts), no imports from apps/ or supabase/. If a task needs the engine to know about the network, the task is wrong — stop and flag it.
- All user-facing strings go through i18n keys (he+en). Never hardcode. Test RTL.
- All tunable game numbers live in packages/engine/src/config/balance.ts only.
- Server is authoritative: clients never write game state directly; all writes via supabase/functions.
- Every new engine behavior ships with unit tests; determinism suite must stay green.
- DB changes = new migration file, never edit old migrations.
- Small PRs: one task from docs/DEV_PLAN.md per branch. Reference the task checkbox.
- Definition of done: acceptance criteria of the task met + CI green + DEV_PLAN checkbox ticked.
```

### 8.2 How to slice work for agents
- Give one Phase task per session, pasting the relevant §§ of this doc (esp. §2 tables + §3.10 for engine tasks).
- Engine first, UI later — agents excel at pure-logic + tests; you review the sim outputs, not every line.
- For UI tasks, include a sketch/screenshot or a text wireframe; ask the agent to build with placeholder art + storybook-style demo screens where possible.
- Ask agents to end each session by updating the checkbox in this file + a 3-line CHANGELOG entry.

### 8.3 Suggested first three agent sessions
1. "Phase 0: set up the monorepo exactly as §3.2, CI as Phase 0 says." 
2. "Phase 1: implement types.ts + balance.ts + rng.ts from §2 tables and §3.10, with tests."
3. "Phase 1: implement validatePlan with the sequential simulation rules in §3.10 + exhaustive tests."

---

## 9. Open Decisions (answer these before their phase)
- [ ] Final game name + trademark/domain check (before Phase 6, ideally before Phase 4 art).
- [ ] Currency display: neutral "coins" vs localized ₪/$ (leaning localized-cosmetic).
- [ ] Reveal length: 18s default — validate in Phase 5 with skip-rate analytics.
- [ ] Voice/roast tone in Hebrew: who writes/reviews the comedy? (You. Agents draft, you punch up.)
- [ ] In-game chat/emotes in live mode: v1 = 6 quick emotes only (moderation-free), full chat later?
- [ ] Team/spectator modes: parked until post-launch.

*Last updated: 2026-07-17 · v1.2 (Phases 0–2 complete) · Next review: end of Phase 3*
