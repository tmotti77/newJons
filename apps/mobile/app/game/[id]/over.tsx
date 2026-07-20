import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { netWorth, totalCourses, type PlayerState } from "@fastlane/engine";

import { Avatar, Button, Card, Screen } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { useGameChannel } from "../../../src/lib/realtime";
import { useGameStore } from "../../../src/stores/gameStore";
import { colors, spacing, type } from "../../../src/theme";

export default function GameOver() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  useGameChannel(id ?? null);
  const snapshot = useGameStore((s) => s.snapshot);
  const clearGame = useGameStore((s) => s.clearGame);
  const hydrate = useGameStore((s) => s.hydrateFromSnapshot);
  const [rematching, setRematching] = useState(false);

  if (!snapshot || snapshot.game.id !== id) {
    return (
      <Screen style={{ justifyContent: "center" }}>
        <Text style={[type.dim, { textAlign: "center" }]}>{t("common.loading")}</Text>
      </Screen>
    );
  }

  const winner = snapshot.players.find((p) => p.playerId === snapshot.game.winnerId);
  const cryptoPrice = snapshot.game.globalState?.cryptoPrice ?? 100;
  const ranked = [...snapshot.players].sort((a, b) => {
    const sa = a.state as PlayerState;
    const sb = b.state as PlayerState;
    return netWorth(sb, cryptoPrice) - netWorth(sa, cryptoPrice);
  });

  const home = () => {
    clearGame();
    router.replace("/");
  };

  const rematchExists = snapshot.game.rematchGameId !== null;

  const rematch = async () => {
    if (!id || rematching) return;
    setRematching(true);
    try {
      const { gameId: newId, snapshot: fresh } = await api.rematchGame(id);
      hydrate(fresh);
      router.replace(`/game/${newId}/lobby` as never);
    } catch {
      setRematching(false); // next doorbell may surface an existing rematch
    }
  };

  return (
    <Screen style={{ gap: spacing.xl, justifyContent: "center" }}>
      <View style={{ alignItems: "center", gap: spacing.m }}>
        <Text style={{ fontSize: 64 }}>🏆</Text>
        {winner ? (
          <>
            <Avatar id={winner.avatar} size={84} />
            <Text style={type.title}>{winner.displayName}</Text>
            <Text style={[type.h2, { color: colors.primary }]}>{t("over.wins")}</Text>
          </>
        ) : (
          <Text style={type.title}>{t("over.timeUp")}</Text>
        )}
      </View>

      <Card style={{ gap: spacing.m }}>
        {ranked.map((p, i) => {
          const st = p.state as PlayerState;
          return (
            <View
              key={p.playerId}
              style={{ flexDirection: "row", alignItems: "center", gap: spacing.m }}
            >
              <Text style={[type.h2, { width: 24 }]}>{i + 1}.</Text>
              <Avatar id={p.avatar} size={36} />
              <Text style={[type.body, { flex: 1 }]}>{p.displayName}</Text>
              <Text style={type.dim}>
                ₪{netWorth(st, cryptoPrice)} · 😊{st.happiness} · 🎓{totalCourses(st)} · 💼T
                {Math.max(0, st.jobTier)}
              </Text>
            </View>
          );
        })}
      </Card>

      <View style={{ gap: spacing.m }}>
        <Button
          label={rematchExists ? t("over.joinRematch") : t("over.playAgain")}
          disabled={rematching}
          onPress={() => void rematch()}
        />
        <Button label={t("over.home")} variant="ghost" onPress={home} />
      </View>
    </Screen>
  );
}
