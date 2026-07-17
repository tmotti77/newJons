/**
 * Realtime wiring (§3.5): one channel per game. DB rows are truth; realtime
 * is just the doorbell — every event triggers a full snapshot refetch via
 * the single hydration path.
 */
import { useEffect, useRef } from "react";
import { AppState } from "react-native";

import { api } from "./api";
import { supabase } from "./supabase";
import { useGameStore } from "../stores/gameStore";

export function useGameChannel(gameId: string | null): void {
  const hydrate = useGameStore((s) => s.hydrateFromSnapshot);
  const refetching = useRef(false);

  useEffect(() => {
    if (!gameId) return;

    const refetch = async () => {
      if (refetching.current) return;
      refetching.current = true;
      try {
        const { snapshot } = await api.rejoinGame(gameId);
        hydrate(snapshot);
      } catch {
        // transient — next doorbell or poll retries
      } finally {
        refetching.current = false;
      }
    };

    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "games", filter: `id=eq.${gameId}` },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "rounds", filter: `game_id=eq.${gameId}` },
        () => void refetch()
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "game_players", filter: `game_id=eq.${gameId}` },
        () => void refetch()
      )
      .subscribe();

    // Reconnect on foreground (§3.7) + safety poll (covers missed events).
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") void refetch();
    });
    const poll = setInterval(() => void refetch(), 5000);

    void refetch();

    return () => {
      sub.remove();
      clearInterval(poll);
      void supabase.removeChannel(channel);
    };
  }, [gameId, hydrate]);
}
