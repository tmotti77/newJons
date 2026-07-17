import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { api } from "../src/lib/api";
import { ensureSession } from "../src/lib/auth";
import { getLastGameId, loadProfile } from "../src/stores/gameStore";
import { applyRTL } from "../src/i18n";
import { colors, spacing, type } from "../src/theme";
import { Button, Card, Screen } from "../src/components/ui";

export default function Home() {
  const { t, i18n } = useTranslation();
  const [authError, setAuthError] = useState<string | null>(null);
  const [resumeGameId, setResumeGameId] = useState<string | null>(null);

  useEffect(() => {
    void (async () => {
      const session = await ensureSession();
      if ("error" in session) setAuthError(session.error);
      const last = await getLastGameId();
      if (last) {
        try {
          const { snapshot } = await api.rejoinGame(last);
          if (snapshot.game.status === "lobby" || snapshot.game.status === "active") {
            setResumeGameId(last);
          }
        } catch {
          // stale — ignore
        }
      }
    })();
  }, []);

  const go = async (path: string) => {
    const profile = await loadProfile();
    if (!profile) router.push({ pathname: "/setup", params: { next: path } });
    else router.push(path as never);
  };

  const toggleLanguage = () => {
    const next = i18n.language === "he" ? "en" : "he";
    void i18n.changeLanguage(next);
    applyRTL(next);
  };

  return (
    <Screen style={{ justifyContent: "center", gap: spacing.xl }}>
      <View style={{ alignItems: "center", gap: spacing.s }}>
        <Text style={{ fontSize: 64 }}>🏎️</Text>
        <Text style={type.title}>{t("home.title")}</Text>
        <Text style={[type.dim, { textAlign: "center" }]}>{t("home.tagline")}</Text>
      </View>

      {authError ? (
        <Card style={{ borderColor: colors.danger }}>
          <Text style={[type.body, { color: colors.danger }]}>{t("home.authError")}</Text>
          <Text style={type.dim}>{authError}</Text>
        </Card>
      ) : null}

      {resumeGameId ? (
        <Button
          label={t("home.resume")}
          variant="secondary"
          onPress={() => router.push(`/game/${resumeGameId}/lobby` as never)}
        />
      ) : null}

      <View style={{ gap: spacing.m }}>
        <Button label={t("home.createGame")} onPress={() => void go("/create")} />
        <Button label={t("home.joinGame")} variant="secondary" onPress={() => void go("/join")} />
        <Button label={t("home.howToPlay")} variant="ghost" onPress={() => router.push("/how-to-play")} />
      </View>

      <Button label={`${t("common.language")}: ${i18n.language === "he" ? "עברית" : "English"}`} variant="ghost" onPress={toggleLanguage} />
    </Screen>
  );
}
