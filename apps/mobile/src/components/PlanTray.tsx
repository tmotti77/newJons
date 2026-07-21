/**
 * Plan tray (§4.2, flat-vector reskin §4.1): ordered chips of queued
 * actions with running totals. Tap a chip (or its ✕) to delete it.
 * Actions with real location context (travel destination, studying,
 * buying) get the location's crafted `LocationIcon`; everything else
 * keeps its type glyph. Invalid actions get a `flat.coral` outline/tint.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  ITEMS,
  TIME_UNITS_PER_WEEK,
  type Action,
  type LocationId,
  type ValidationResult
} from "@fastlane/engine";

import { colors, flat, radius, spacing, type } from "../theme";
import { LocationIcon } from "./LocationIcon";

/** Fallback type glyph for actions with no derivable location context. */
const TYPE_GLYPH: Record<Action["type"], string> = {
  travel: "🚶",
  work: "💪",
  study: "📚",
  buy: "🛍",
  buyOutfit: "👔",
  sell: "💸",
  eat: "🍽",
  bank: "🏦",
  crypto: "🚀",
  lottery: "🎟",
  fun: "🎉",
  payRent: "🏢",
  moveApartment: "📦",
  applyJob: "💼",
  rest: "😴"
};

/**
 * Where an action's own data (no external player/game state) pins it to a
 * real place: travel's destination, studying (college is the canonical
 * venue — the home+laptop case has no distinct spot to draw), and buying
 * (the item's catalog `buyAt`). Everything else either has no fixed
 * location (`work`, whichever job is current) or isn't location-flavored.
 */
function actionLocationId(a: Action): LocationId | undefined {
  switch (a.type) {
    case "travel":
      return a.to;
    case "study":
      return "college";
    case "buy":
      return ITEMS.find((it) => it.id === a.item)?.buyAt;
    default:
      return undefined;
  }
}

function actionText(a: Action, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (a.type) {
    case "travel":
      return t(`loc.${a.to}`);
    case "work":
      return t("chip.work", { tu: a.tu });
    case "study":
      return t(`track.${a.courseTrack}`);
    case "buy":
      return t(`item.${a.item}`);
    case "buyOutfit":
      return t(`outfit.${a.outfit}`);
    case "sell":
      return t(`item.${a.item}`);
    case "eat":
      return t(`chip.eat.${a.kind}`);
    case "bank":
      return a.op === "deposit" ? `+₪${a.amount}` : `−₪${a.amount}`;
    case "crypto":
      return a.op === "buy" ? `+₪${a.amount}` : `−₪${a.amount}`;
    case "lottery":
      return `×${a.tickets}`;
    case "fun":
      return t(`chip.fun.${a.kind}`);
    case "payRent":
      return t("chip.rent");
    case "moveApartment":
      return t("chip.move");
    case "applyJob":
      return `T${a.tier}`;
    case "rest":
      return `${a.tu} TU`;
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
        <Text
          style={[
            type.dim,
            styles.totalText,
            { color: tuUsed > TIME_UNITS_PER_WEEK ? colors.danger : colors.textDim }
          ]}
        >
          ⏱ {t("plan.tuLeft", { left: Math.max(0, TIME_UNITS_PER_WEEK - tuUsed) })}
        </Text>
        <Text style={[type.dim, styles.totalText]}>
          💵 {t("plan.projected", { cash: Math.floor(cash) })}
        </Text>
      </View>
      {props.plan.length === 0 ? (
        <Text style={[type.dim, { textAlign: "center", paddingVertical: spacing.s }]}>
          {t("plan.empty")}
        </Text>
      ) : (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: spacing.s }}
        >
          {props.plan.map((a, i) => {
            const locId = actionLocationId(a);
            const bad = badIndexes.has(i);
            return (
              <Pressable
                key={`${i}-${a.type}`}
                onPress={() => props.onRemove(i)}
                style={[styles.chip, bad && styles.chipError]}
              >
                {locId ? (
                  <LocationIcon id={locId} size={16} />
                ) : (
                  <Text style={styles.glyph}>{TYPE_GLYPH[a.type]}</Text>
                )}
                <Text style={[type.body, styles.chipLabel]}>{actionText(a, t)}</Text>
                <Text style={styles.removeGlyph}>✕</Text>
              </Pressable>
            );
          })}
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
    borderWidth: 2,
    borderColor: flat.outline
  },
  totals: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  totalText: { fontWeight: "700" },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.card,
    borderWidth: 2,
    borderColor: flat.outline,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 8
  },
  chipError: {
    borderColor: flat.coral,
    backgroundColor: `${flat.coral}26`
  },
  glyph: { fontSize: 14 },
  chipLabel: { fontSize: 13 },
  removeGlyph: { fontSize: 11, fontWeight: "600", color: colors.textFaint }
});
