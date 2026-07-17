import { router } from "expo-router";
import React, { useState } from "react";
import { Text, TextInput } from "react-native";
import { useTranslation } from "react-i18next";

import { api } from "../src/lib/api";
import { loadProfile, useGameStore } from "../src/stores/gameStore";
import { colors, radius, spacing, type } from "../src/theme";
import { Button, Screen } from "../src/components/ui";

export default function JoinGame() {
  const { t } = useTranslation();
  const hydrate = useGameStore((s) => s.hydrateFromSnapshot);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const join = async () => {
    setBusy(true);
    setError(null);
    try {
      const profile = await loadProfile();
      if (!profile) return router.replace("/setup");
      const res = await api.joinGame(code.trim().toUpperCase(), profile.displayName, profile.avatar);
      hydrate(res.snapshot);
      router.replace(`/game/${res.gameId}/lobby` as never);
    } catch (e) {
      const msg = (e as Error).message;
      setError(t(msg.startsWith("err.") ? msg : "join.failed"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen style={{ justifyContent: "center", gap: spacing.xl }}>
      <Text style={[type.h1, { textAlign: "center" }]}>{t("join.title")}</Text>
      <TextInput
        value={code}
        onChangeText={(v) => setCode(v.toUpperCase())}
        placeholder="ABCDE"
        placeholderTextColor={colors.textFaint}
        autoCapitalize="characters"
        autoCorrect={false}
        maxLength={5}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.m,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          padding: spacing.l,
          fontSize: 32,
          letterSpacing: 12,
          textAlign: "center",
          fontWeight: "800"
        }}
      />
      {error ? <Text style={[type.body, { color: colors.danger, textAlign: "center" }]}>{error}</Text> : null}
      <Button label={t("join.go")} onPress={() => void join()} loading={busy} disabled={code.length !== 5} />
      <Button label={t("common.back")} variant="ghost" onPress={() => router.back()} />
    </Screen>
  );
}
