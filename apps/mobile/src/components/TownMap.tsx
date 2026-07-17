/**
 * The town (§4.2): a tappable grid of buildings. Current location is
 * highlighted; tapping auto-inserts travel and opens the action sheet.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { LocationId } from "@fastlane/engine";

import { colors, LOCATION_META, radius, spacing, type } from "../theme";

const GRID: LocationId[] = [
  "home", "burgerBarn", "quickMart",
  "theSpot", "rentALord", "flipIt",
  "college", "gadgetCity", "dressCode",
  "careerHub", "bank"
];

export function TownMap(props: {
  current: LocationId;
  onSelect: (loc: LocationId) => void;
}) {
  const { t } = useTranslation();
  return (
    <View style={styles.grid}>
      {GRID.map((loc) => {
        const here = props.current === loc;
        return (
          <Pressable
            key={loc}
            onPress={() => props.onSelect(loc)}
            style={({ pressed }) => [
              styles.tile,
              here && styles.tileHere,
              pressed && { backgroundColor: colors.cardPressed }
            ]}
          >
            <Text style={{ fontSize: 26 }}>{LOCATION_META[loc]?.emoji}</Text>
            <Text style={[type.tiny, { color: here ? colors.primary : colors.textDim, textAlign: "center" }]} numberOfLines={1}>
              {t(`loc.${loc}`)}
            </Text>
            {here ? <Text style={[type.tiny, { color: colors.primary }]}>📍</Text> : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: spacing.s,
    justifyContent: "center"
  },
  tile: {
    width: "30.5%",
    aspectRatio: 1.15,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    borderWidth: 1,
    borderColor: colors.border,
    alignItems: "center",
    justifyContent: "center",
    gap: 2,
    padding: 4
  },
  tileHere: { borderColor: colors.primary, borderWidth: 2 }
});
