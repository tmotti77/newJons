// packages/engine — pure, deterministic TypeScript game engine.
// Golden rule (DEV_PLAN §3.3 / §8.1): no I/O, no Date.now(), no Math.random(),
// no imports from apps/ or supabase/. Phase 1 fills this in (types, rng,
// validate, resolve, events, goals). This stub only proves the package
// builds and tests run in CI ahead of that work.
export { TIME_UNITS_PER_WEEK } from "./config/balance";
