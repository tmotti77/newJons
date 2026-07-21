/**
 * A flat-vector building "card" for the town map (§4.2 reskin): a rounded,
 * thick-outlined body filled with the location's brand colour, a signboard
 * with its name, and its crafted icon. `highlighted` marks the player's
 * current location with a soft glow ring.
 */
import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { LocationId } from "@fastlane/engine";

import { BUILDING_COLOR, colors, flat, radius, type } from "../theme";
import { LocationIcon } from "./LocationIcon";

export function Building(props: {
  id: LocationId;
  label: string;
  onPress: () => void;
  highlighted?: boolean;
  size?: number;
}) {
  const { id, label, onPress, highlighted, size = 60 } = props;
  const glowSize = size + 14;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      hitSlop={8}
      style={({ pressed }) => [styles.wrap, pressed && styles.pressed]}
    >
      <View
        style={[
          styles.glow,
          { width: glowSize, height: glowSize, borderRadius: glowSize / 2 },
          highlighted ? styles.glowOn : null
        ]}
      >
        <View
          style={[
            styles.body,
            {
              width: size,
              height: size,
              borderRadius: radius.m,
              backgroundColor: BUILDING_COLOR[id],
              borderColor: flat.outline
            }
          ]}
        >
          <LocationIcon id={id} size={Math.round(size * 0.55)} />
        </View>
      </View>
      <View style={styles.sign}>
        <Text style={[type.tiny, styles.signText]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: "center", gap: 3 },
  pressed: { transform: [{ scale: 0.92 }] },
  glow: {
    alignItems: "center",
    justifyContent: "center"
  },
  glowOn: {
    backgroundColor: "rgba(255, 197, 61, 0.30)",
    borderWidth: 2,
    borderColor: colors.primary
  },
  body: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    shadowColor: flat.outline,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 3
  },
  sign: {
    backgroundColor: "#FFF7E4",
    borderColor: flat.outline,
    borderWidth: 1.5,
    borderRadius: radius.s,
    paddingHorizontal: 6,
    paddingVertical: 1,
    maxWidth: 82
  },
  signText: {
    color: flat.outline,
    textAlign: "center"
  }
});
