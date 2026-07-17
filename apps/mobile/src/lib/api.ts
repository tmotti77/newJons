/**
 * Typed client for the deployed api edge function (§3.9). Clients send
 * intents; the server is authoritative. Every call returns the fresh
 * snapshot where applicable so the store can hydrate.
 */
import type { ActionInput, GameSettingsInput, GameSnapshot } from "@fastlane/shared";

import { getAccessToken } from "./auth";
import { API_URL } from "./supabase";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    public detail?: unknown
  ) {
    super(code);
  }
}

async function call<T>(route: string, body: unknown): Promise<T> {
  const token = await getAccessToken();
  if (!token) throw new ApiError(401, "err.auth");
  const res = await fetch(`${API_URL}/${route}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) {
    throw new ApiError(res.status, (data.error as string) ?? "err.unknown", data.detail);
  }
  return data as T;
}

export interface SnapshotResponse {
  snapshot: GameSnapshot;
}

export const api = {
  createGame: (displayName: string, avatar: string, settings: GameSettingsInput) =>
    call<{ gameId: string; code: string; snapshot: GameSnapshot }>("create-game", {
      displayName,
      avatar,
      settings
    }),
  joinGame: (code: string, displayName: string, avatar: string) =>
    call<{ gameId: string; snapshot: GameSnapshot }>("join-game", { code, displayName, avatar }),
  startGame: (gameId: string) => call<SnapshotResponse>("start-game", { gameId }),
  submitPlan: (gameId: string, roundNumber: number, plan: ActionInput[]) =>
    call<{ ok: boolean; submitted: number; players: number; resolved: boolean }>("submit-plan", {
      gameId,
      roundNumber,
      plan
    }),
  resolveRound: (gameId: string, roundNumber: number) =>
    call<{ status: string }>("resolve-round", { gameId, roundNumber }),
  rejoinGame: (gameId: string) => call<SnapshotResponse>("rejoin-game", { gameId }),
  leaveGame: (gameId: string, playerId?: string) =>
    call<{ ok: boolean }>("leave-game", playerId ? { gameId, playerId } : { gameId })
};
