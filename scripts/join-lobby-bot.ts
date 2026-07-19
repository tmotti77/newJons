/**
 * Joins an existing lobby by room code and auto-plays the whole game with the
 * engine's greedy bot. Useful as an opponent-filler for real-device playtests:
 * play on your phone, run one or more of these as the other players.
 *
 * Run: SUPABASE_ANON_KEY=... pnpm exec tsx scripts/join-lobby-bot.ts <CODE> [name]
 */

import { EnvHttpProxyAgent, setGlobalDispatcher } from "undici";
if (process.env.HTTPS_PROXY || process.env.HTTP_PROXY) {
  setGlobalDispatcher(new EnvHttpProxyAgent());
}

import { greedyPlan } from "../packages/engine/src/bots/greedy";
import type { GameState, PlayerState } from "../packages/engine/src/types";
import { GOAL_PRESETS } from "../packages/engine/src/config/balance";

const URL = process.env.SUPABASE_URL ?? "https://viwjknigxfxwszfvxsrg.supabase.co";
const ANON = process.env.SUPABASE_ANON_KEY ?? "";
const API = `${URL}/functions/v1/api`;

const code = process.argv[2]?.toUpperCase();
const name = process.argv[3] ?? "RoboRival";
if (!ANON || !code) {
  console.error("usage: SUPABASE_ANON_KEY=<anon> tsx scripts/join-lobby-bot.ts <CODE> [name]");
  process.exit(1);
}

async function api(route: string, token: string, body: unknown): Promise<any> {
  const res = await fetch(`${API}/${route}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}`, apikey: ANON },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, ...data };
}

function engineStateFromSnapshot(snap: any): GameState {
  return {
    seed: snap.game.seed,
    week: snap.game.globalState?.week ?? 1,
    settings: {
      goals: {
        ...(GOAL_PRESETS[snap.game.settings.goalPreset as keyof typeof GOAL_PRESETS] ??
          GOAL_PRESETS.quick)
      },
      maxWeeks: snap.game.settings.maxWeeks,
      planTimerSeconds: snap.game.settings.planTimerSeconds
    },
    rentMultiplier: snap.game.globalState?.rentMultiplier ?? 1,
    cryptoPrice: snap.game.globalState?.cryptoPrice ?? 100,
    players: snap.players
      .slice()
      .sort((a: any, b: any) => a.slot - b.slot)
      .map((p: any) => p.state as PlayerState)
  };
}

async function main() {
  // Anonymous sign-in: same zero-friction path the app itself uses (§3.6).
  const authRes = await fetch(`${URL}/auth/v1/signup`, {
    method: "POST",
    headers: { "Content-Type": "application/json", apikey: ANON },
    body: JSON.stringify({})
  });
  const auth = await authRes.json();
  if (!auth.access_token) throw new Error(`anon sign-in failed: ${JSON.stringify(auth)}`);
  const token: string = auth.access_token;

  const joined = await api("join-game", token, { code, displayName: name, avatar: "a3" });
  if (!joined.snapshot) throw new Error(`join failed: ${JSON.stringify(joined)}`);
  const gameId: string = joined.snapshot.game.id;
  console.log(`joined ${code} (${gameId}) as ${name} — waiting for host to start`);

  let submittedRound = 0;
  for (;;) {
    const r = await api("rejoin-game", token, { gameId });
    const snap = r.snapshot;
    if (!snap) throw new Error(`rejoin failed: ${JSON.stringify(r)}`);
    if (snap.game.status === "finished") {
      console.log(`game finished — winner=${snap.game.winnerId?.slice(0, 8)}`);
      return;
    }
    const round = snap.round;
    if (snap.game.status === "active" && round?.status === "planning") {
      if (round.roundNumber > submittedRound) {
        const plan = greedyPlan(engineStateFromSnapshot(snap), snap.mySlot);
        const res = await api("submit-plan", token, {
          gameId,
          roundNumber: round.roundNumber,
          plan
        });
        if (res.status === 200) {
          submittedRound = round.roundNumber;
          console.log(`week ${round.roundNumber}: plan submitted (${plan.length} actions)`);
        } else if (res.error === "err.round.stale" || res.error === "err.round.locked") {
          submittedRound = round.roundNumber;
        } else {
          console.warn(`week ${round.roundNumber}: submit failed: ${JSON.stringify(res)}`);
        }
      } else if (Date.parse(round.endsAt) < Date.now() - 1500) {
        // Timer expired: any client may trigger the idempotent resolve (§3.4b).
        await api("resolve-round", token, { gameId, roundNumber: round.roundNumber });
      }
    }
    await new Promise((res) => setTimeout(res, 1500));
  }
}

main().catch((e) => {
  console.error("bot failed:", e);
  process.exit(1);
});
