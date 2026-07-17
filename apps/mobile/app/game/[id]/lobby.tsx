import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect } from "react";
import { Share, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { api } from "../../../src/lib/api";
import { useGameChannel } from "../../../src/lib/realtime";
import { useGameStore } from "../../../src/stores/gameStore";
import { spacing, type } from "../../../src/theme";
import { Avatar, Button, Card, Screen } from "../../../src/components/ui";

export default function Lobby() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  const snapshot = useGameStore((s) => s.snapshot);
  useGameChannel(id ?? null);

  const myId = snapshot?.players.find((p) => p.slot === snapshot.mySlot)?.playerId ?? null;
  const isHost = snapshot && myId === snapshot.game.hostId;

  // Route on state transitions.
  useEffect(() => {
    if (!snapshot || snapshot.game.id !== id) return;
    if (snapshot.game.status === "active") router.replace(`/game/${id}/play` as never);
    if (snapshot.game.status === "finished") router.replace(`/game/${id}/over` as never);
  }, [snapshot, id]);

  if (!snapshot || snapshot.game.id !== id) {
    return (
      <Screen style={{ justifyContent: "center" }}>
        <Text style={[type.dim, { textAlign: "center" }]}>{t("common.loading")}</Text>
      </Screen>
    );
  }

  const share = () =>
    void Share.share({ message: t("lobby.shareMessage", { code: snapshot.game.code }) });

  const start = async () => {
    try {
      await api.startGame(snapshot.game.id);
    } catch {
      // snapshot refetch shows any error state
    }
  };

  const leave = async () => {
    try {
      await api.leaveGame(snapshot.game.id);
    } finally {
      useGameStore.getState().clearGame();
      router.replace("/");
    }
  };

  return (
    <Screen style={{ gap: spacing.xl }}>
      <View style={{ alignItems: "center", gap: spacing.s, marginTop: spacing.xl }}>
        <Text style={type.dim}>{t("lobby.codeLabel")}</Text>
        <Text style={[type.title, { letterSpacing: 10 }]}>{snapshot.game.code}</Text>
        <Button label={t("lobby.share")} variant="secondary" onPress={share} style={{ paddingVertical: 8 }} />
      </View>

      <Card style={{ gap: spacing.m }}>
        <Text style={type.h2}>
          {t("lobby.players", { n: snapshot.players.length })}
        </Text>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.m }}>
          {snapshot.players.map((p) => (
            <View key={p.playerId} style={{ alignItems: "center", gap: 4, width: 64 }}>
              <Avatar id={p.avatar} size={52} dim={!p.isConnected} />
              <Text style={type.tiny} numberOfLines={1}>
                {p.displayName}
                {p.playerId === snapshot.game.hostId ? " 👑" : ""}
              </Text>
            </View>
          ))}
        </View>
      </Card>

      <Card style={{ padding: spacing.m }}>
        <Text style={type.dim}>
          {t(`preset.${snapshot.game.settings.goalPreset}`)} · ⏱ {snapshot.game.settings.planTimerSeconds}s ·{" "}
          {t("lobby.maxWeeks", { n: snapshot.game.settings.maxWeeks })}
        </Text>
      </Card>

      <View style={{ flex: 1 }} />

      {isHost ? (
        <Button
          label={snapshot.players.length < 2 ? t("lobby.needTwo") : t("lobby.start")}
          disabled={snapshot.players.length < 2}
          onPress={() => void start()}
        />
      ) : (
        <Text style={[type.dim, { textAlign: "center" }]}>{t("lobby.waitingForHost")}</Text>
      )}
      <Button label={t("lobby.leave")} variant="ghost" onPress={() => void leave()} />
    </Screen>
  );
}
