/**
 * Plan tray (§4.2): ordered chips of queued actions with running totals.
 * Tap a chip to delete it. Invalid actions highlight in red.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { TIME_UNITS_PER_WEEK, type Action, type ValidationResult } from "@fastlane/engine";

import { colors, radius, spacing, type } from "../theme";

function actionLabel(a: Action, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (a.type) {
    case "travel": return `🚶 ${t(`loc.${a.to}`)}`;
    case "work": return `💪 ${t("chip.work", { tu: a.tu })}`;
    case "study": return `📚 ${t(`track.${a.courseTrack}`)}`;
    case "buy": return `🛍 ${t(`item.${a.item}`)}`;
    case "buyOutfit": return `👔 ${t(`outfit.${a.outfit}`)}`;
    case "sell": return `💸 ${t(`item.${a.item}`)}`;
    case "eat": return `🍽 ${t(`chip.eat.${a.kind}`)}`;
    case "bank": return a.op === "deposit" ? `🏦 +₪${a.amount}` : `🏦 −₪${a.amount}`;
    case "crypto": return a.op === "buy" ? `🚀 +₪${a.amount}` : `🚀 −₪${a.amount}`;
    case "lottery": return `🎟 ×${a.tickets}`;
    case "fun": return `🎉 ${t(`chip.fun.${a.kind}`)}`;
    case "payRent": return `🏢 ${t("chip.rent")}`;
    case "moveApartment": return `📦 ${t("chip.move")}`;
    case "applyJob": return `💼 T${a.tier}`;
    case "rest": return `😴 ${a.tu} TU`;
  }
}

export function PlanTray(props: {
  plan: Action[];
  validation: ValidationResult | null;
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  const badIndexes = new Set(props.validation?.errors.map((e) => e.index) ?? []);
  const tuUsed = props.validation?.projected?.tuUsed ?? 0;
  const cash = props.validation?.projected?.cash ?? 0;

  return (
    <View style={styles.tray}>
      <View style={styles.totals}>
        <Text style={[type.dim, { color: tuUsed > TIME_UNITS_PER_WEEK ? colors.danger : colors.textDim }]}>
          ⏱ {t("plan.tuLeft", { left: Math.max(0, TIME_UNITS_PER_WEEK - tuUsed) })}
        </Text>
        <Text style={type.dim}>💵 {t("plan.projected", { cash: Math.floor(cash) })}</Text>
      </View>
      {props.plan.length === 0 ? (
        <Text style={[type.dim, { textAlign: "center", paddingVertical: spacing.s }]}>
          {t("plan.empty")}
        </Text>
      ) : (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.s }}>
          {props.plan.map((a, i) => (
            <Pressable
              key={`${i}-${a.type}`}
              onPress={() => props.onRemove(i)}
              style={[styles.chip, badIndexes.has(i) && { borderColor: colors.danger, backgroundColor: "#3A1D2A" }]}
            >
              <Text style={[type.body, { fontSize: 13 }]}>{actionLabel(a, t)}</Text>
              <Text style={[type.tiny, { color: colors.textFaint }]}>✕</Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tray: {
    backgroundColor: colors.bgElevated,
    borderRadius: radius.l,
    padding: spacing.m,
    gap: spacing.s,
    borderWidth: 1,
    borderColor: colors.border
  },
  totals: { flexDirection: "row", justifyContent: "space-between" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  }
});
