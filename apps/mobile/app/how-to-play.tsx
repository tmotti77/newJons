import { router } from "expo-router";
import React from "react";
import { ScrollView, Text } from "react-native";
import { useTranslation } from "react-i18next";

import { Button, Card, Screen } from "../src/components/ui";
import { spacing, type } from "../src/theme";

const STEPS = ["goal", "time", "plan", "reveal", "win"] as const;
const ICONS = { goal: "🎯", time: "⏱", plan: "🗺", reveal: "🎭", win: "🏆" };

export default function HowToPlay() {
  const { t } = useTranslation();
  return (
    <Screen>
      <ScrollView contentContainerStyle={{ gap: spacing.m, paddingBottom: spacing.xl }}>
        <Text style={[type.h1, { textAlign: "center", marginVertical: spacing.l }]}>
          {t("howto.title")}
        </Text>
        {STEPS.map((s) => (
          <Card key={s} style={{ flexDirection: "row", gap: spacing.l, alignItems: "center" }}>
            <Text style={{ fontSize: 34 }}>{ICONS[s]}</Text>
            <Text style={[type.body, { flex: 1 }]}>{t(`howto.${s}`)}</Text>
          </Card>
        ))}
        <Button label={t("common.back")} onPress={() => router.back()} />
      </ScrollView>
    </Screen>
  );
}
