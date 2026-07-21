/**
 * TimeMeter: the draining time-budget bar for the planning screen.
 * Used time units render in flat.coral, remaining in flat.teal, with a
 * bold "remaining / total TU" label and light tick marks every fifth.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";

import { colors, flat, spacing, type } from "../theme";

const BAR_HEIGHT = 16;

export function TimeMeter(props: { used: number; total: number }): JSX.Element {
  const total = props.total > 0 ? props.total : 0;
  const used = Math.min(total, Math.max(0, props.used));
  const remaining = Math.max(0, total - used);
  const isDepleted = total <= 0 || used >= total;

  const tickStep = total / 5;
  const tickValues = tickStep > 0 ? [1, 2, 3, 4].map((i) => i * tickStep) : [];

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {isDepleted ? `0 / ${total} TU` : `${remaining} / ${total} TU`}
      </Text>
      <View style={styles.track}>
        <View style={styles.fillRow}>
          {isDepleted ? (
            <View style={[styles.segment, { flex: 1, backgroundColor: flat.coral }]} />
          ) : (
            <>
              <View style={[styles.segment, { flex: used, backgroundColor: flat.coral }]} />
              <View style={[styles.segment, { flex: remaining, backgroundColor: flat.teal }]} />
            </>
          )}
        </View>
        <View style={styles.tickOverlay} pointerEvents="none">
          {tickValues.map((tickValue) => (
            <View
              key={tickValue}
              style={[styles.tick, { left: `${(tickValue / total) * 100}%` }]}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { width: "100%", gap: spacing.xs },
  label: {
    ...type.body,
    fontSize: 13,
    fontWeight: "800",
    color: colors.text
  },
  track: {
    width: "100%",
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: "hidden",
    backgroundColor: colors.bgElevated,
    borderWidth: 1,
    borderColor: colors.border
  },
  fillRow: {
    flex: 1,
    flexDirection: "row"
  },
  segment: {
    height: "100%"
  },
  tickOverlay: {
    ...StyleSheet.absoluteFillObject
  },
  tick: {
    position: "absolute",
    top: 0,
    bottom: 0,
    width: 2,
    marginLeft: -1,
    backgroundColor: "rgba(0, 0, 0, 0.18)"
  }
});
