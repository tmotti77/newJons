import { z } from "zod";

// Phase 2 will expand this with the full edge-function request/response
// schemas (§3.9) and the Action union (§3.10). This stub proves the
// package/test wiring and gives both client and edge functions one
// real shared schema to import from day one.
export const displayNameSchema = z
  .string()
  .min(1)
  .max(20);

export const gameModeSchema = z.enum(["live", "async", "solo"]);
export type GameMode = z.infer<typeof gameModeSchema>;
