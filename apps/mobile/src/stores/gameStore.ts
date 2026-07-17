/**
 * Client game state (§4.4). ONE hydration path: hydrateFromSnapshot() is
 * used by initial join AND every reconnect/doorbell. The engine runs
 * locally only for validatePlan projections — never for resolution.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { create } from "zustand";

import {
  CRYPTO,
  GOAL_PRESETS,
  validatePlan,
  type Action,
  type GameState,
  type PlayerState,
  type ValidationResult
} from "@fastlane/engine";
import type { ActionInput, GameSnapshot } from "@fastlane/shared";

const LAST_GAME_KEY = "fastlane.lastGameId";

export interface ProfileDraft {
  displayName: string;
  avatar: string;
}

interface GameStore {
  snapshot: GameSnapshot | null;
  planDraft: Action[];
  submitting: boolean;
  submitted: boolean;

  hydrateFromSnapshot: (snapshot: GameSnapshot) => void;
  clearGame: () => void;

  addAction: (action: Action) => void;
  removeAction: (index: number) => void;
  clearPlan: () => void;
  setSubmitted: (v: boolean) => void;
  setSubmitting: (v: boolean) => void;

  engineState: () => GameState | null;
  mySlot: () => number | null;
  myState: () => PlayerState | null;
  validation: () => ValidationResult | null;
}

export const useGameStore = create<GameStore>((set, get) => ({
  snapshot: null,
  planDraft: [],
  submitting: false,
  submitted: false,

  hydrateFromSnapshot: (snapshot) => {
    const prev = get().snapshot;
    const roundChanged =
      prev?.round?.roundNumber !== snapshot.round?.roundNumber || prev?.game.id !== snapshot.game.id;
    set({
      snapshot,
      // New round → fresh plan; same round → keep local draft.
      planDraft: roundChanged ? [] : get().planDraft,
      submitted: roundChanged ? snapshot.myPlan !== null : get().submitted || snapshot.myPlan !== null
    });
    if (snapshot.game.status === "active" || snapshot.game.status === "lobby") {
      void AsyncStorage.setItem(LAST_GAME_KEY, snapshot.game.id);
    } else {
      void AsyncStorage.removeItem(LAST_GAME_KEY);
    }
  },

  clearGame: () => {
    set({ snapshot: null, planDraft: [], submitted: false, submitting: false });
    void AsyncStorage.removeItem(LAST_GAME_KEY);
  },

  addAction: (action) => set({ planDraft: [...get().planDraft, action] }),
  removeAction: (index) => set({ planDraft: get().planDraft.filter((_, i) => i !== index) }),
  clearPlan: () => set({ planDraft: [] }),
  setSubmitted: (v) => set({ submitted: v }),
  setSubmitting: (v) => set({ submitting: v }),

  engineState: () => {
    const snap = get().snapshot;
    if (!snap) return null;
    const goals =
      snap.game.settings.goalPreset === "custom" && snap.game.settings.customGoals
        ? snap.game.settings.customGoals
        : GOAL_PRESETS[
            snap.game.settings.goalPreset === "custom" ? "quick" : snap.game.settings.goalPreset
          ];
    return {
      seed: snap.game.seed,
      week: snap.game.globalState?.week ?? 1,
      settings: {
        goals: { ...goals },
        maxWeeks: snap.game.settings.maxWeeks,
        planTimerSeconds: snap.game.settings.planTimerSeconds
      },
      rentMultiplier: snap.game.globalState?.rentMultiplier ?? 1,
      cryptoPrice: snap.game.globalState?.cryptoPrice ?? CRYPTO.startPrice,
      players: [...snap.players]
        .sort((a, b) => a.slot - b.slot)
        .map((p) => p.state as PlayerState)
    };
  },

  mySlot: () => get().snapshot?.mySlot ?? null,

  myState: () => {
    const snap = get().snapshot;
    if (!snap || snap.mySlot === null) return null;
    return (snap.players.find((p) => p.slot === snap.mySlot)?.state as PlayerState) ?? null;
  },

  validation: () => {
    const state = get().engineState();
    const slot = get().mySlot();
    if (!state || slot === null) return null;
    return validatePlan(state, slot, get().planDraft);
  }
}));

export async function getLastGameId(): Promise<string | null> {
  return AsyncStorage.getItem(LAST_GAME_KEY);
}

/** Local profile (name + avatar), persisted on-device (§4.1 /setup). */
const PROFILE_KEY = "fastlane.profile";

export async function loadProfile(): Promise<ProfileDraft | null> {
  const raw = await AsyncStorage.getItem(PROFILE_KEY);
  return raw ? (JSON.parse(raw) as ProfileDraft) : null;
}

export async function saveProfile(profile: ProfileDraft): Promise<void> {
  await AsyncStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
}

export function toActionInput(a: Action): ActionInput {
  return a as ActionInput;
}
