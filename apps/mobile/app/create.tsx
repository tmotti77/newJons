import { router } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { GOAL_PRESETS } from "@fastlane/engine";

import { api } from "../src/lib/api";
import { loadProfile, useGameStore } from "../src/stores/gameStore";
import { colors, radius, spacing, type } from "../src/theme";
import { Button, Card, Screen } from "../src/components/ui";

const PRESETS = ["quick", "classic", "marathon"] as const;
const TIMERS = [60, 90, 120] as const;

export default function CreateGame() {
  const { t } = useTranslation();
  const hydrate = useGameStore((s) => s.hydrateFromSnapshot);
  const [preset, setPreset] = useState<(typeof PRESETS)[number]>("quick");
  const [timer, setTimer] = useState<(typeof TIMERS)[number]>(90);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const create = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await loadProfile();
      if (!profile) return router.replace("/setup");
      const res = await api.createGame(profile.displayName, profile.avatar, {
        goalPreset: preset,
        planTimerSeconds: timer,
        maxWeeks: 30
      });
      hydrate(res.snapshot);
      router.replace(`/game/${res.gameId}/lobby` as never);
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  };

  const goals = GOAL_PRESETS[preset];

  return (
    <Screen style={{ gap: spacing.xl, justifyContent: "center" }}>
      <Text style={[type.h1, { textAlign: "center" }]}>{t("create.title")}</Text>

      <View style={{ gap: spacing.s }}>
        <Text style={type.dim}>{t("create.preset")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.s }}>
          {PRESETS.map((p) => (
            <Pressable
              key={p}
              onPress={() => setPreset(p)}
              style={{
                flex: 1,
                padding: spacing.m,
                borderRadius: radius.m,
                borderWidth: 2,
                borderColor: preset === p ? colors.primary : colors.border,
                backgroundColor: colors.card,
                alignItems: "center"
              }}
            >
              <Text style={type.h2}>{t(`preset.${p}`)}</Text>
              <Text style={type.tiny}>{t(`preset.${p}Time`)}</Text>
            </Pressable>
          ))}
        </View>
        <Card style={{ padding: spacing.m }}>
          <Text style={type.dim}>
            💵 ₪{goals.netWorth} · 😊 {goals.happiness} · 🎓 {goals.courses} · 💼 T{goals.careerTier}
          </Text>
        </Card>
      </View>

      <View style={{ gap: spacing.s }}>
        <Text style={type.dim}>{t("create.timer")}</Text>
        <View style={{ flexDirection: "row", gap: spacing.s }}>
          {TIMERS.map((s) => (
            <Pressable
              key={s}
              onPress={() => setTimer(s)}
              style={{
                flex: 1,
                padding: spacing.m,
                borderRadius: radius.m,
                borderWidth: 2,
                borderColor: timer === s ? colors.primary : colors.border,
                backgroundColor: colors.card,
                alignItems: "center"
              }}
            >
              <Text style={type.h2}>{s}s</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {error ? <Text style={[type.body, { color: colors.danger, textAlign: "center" }]}>{error}</Text> : null}
      <Button label={t("create.go")} onPress={() => void create()} loading={busy} />
      <Button label={t("common.back")} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
