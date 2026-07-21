/**
 * Core UI kit: buttons, cards, avatars, stat chips. RTL-safe (uses
 * logical flex directions), color-blind-aware stat colors.
 */
import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
  type StyleProp,
  type ViewStyle
} from "react-native";

import { AVATARS, colors, flat, radius, spacing, type } from "../theme";

export function Button(props: {
  label: string;
  onPress?: () => void;
  variant?: "primary" | "secondary" | "ghost" | "danger";
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const { label, onPress, variant = "primary", disabled, loading, style } = props;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        variant === "primary" && { backgroundColor: colors.primary },
        variant === "secondary" && {
          backgroundColor: colors.card,
          borderWidth: 2,
          borderColor: colors.border
        },
        variant === "ghost" && { backgroundColor: "transparent", shadowOpacity: 0, elevation: 0 },
        variant === "danger" && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.45 },
        pressed && {
          transform: [{ scale: 0.98 }, { translateY: 2 }],
          shadowOffset: { width: 0, height: 1 },
          elevation: 1
        },
        style
      ]}
    >
      {loading ? (
        <ActivityIndicator color={variant === "primary" ? colors.primaryText : colors.text} />
      ) : (
        <Text
          style={[
            styles.btnLabel,
            variant === "primary" && { color: colors.primaryText },
            variant === "ghost" && { color: colors.textDim }
          ]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}

export function Card(props: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, props.style]}>{props.children}</View>;
}

export function Screen(props: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.screen, props.style]}>{props.children}</View>;
}

export function Avatar(props: { id: string; size?: number; dim?: boolean }) {
  const { id, size = 48, dim } = props;
  const meta = AVATARS[id] ?? AVATARS.a1!;
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: meta.bg,
        alignItems: "center",
        justifyContent: "center",
        opacity: dim ? 0.4 : 1
      }}
    >
      <Text style={{ fontSize: size * 0.55 }}>{meta.emoji}</Text>
    </View>
  );
}

export function StatChip(props: { icon: string; value: string; color?: string; label?: string }) {
  const dotColor = props.color ?? colors.primary;
  return (
    <View style={styles.statChip}>
      <Text style={{ fontSize: 14 }}>{props.icon}</Text>
      <View style={[styles.statDot, { backgroundColor: dotColor }]} />
      <Text style={[type.number, styles.statValue, { color: props.color ?? colors.text }]}>
        {props.value}
      </Text>
      {props.label ? <Text style={type.tiny}>{props.label}</Text> : null}
    </View>
  );
}

export function ProgressBar(props: { pct: number; color: string; height?: number }) {
  const h = props.height ?? 12;
  return (
    <View
      style={{
        height: h,
        borderRadius: h / 2,
        backgroundColor: colors.bgElevated,
        borderWidth: 1,
        borderColor: colors.border,
        overflow: "hidden"
      }}
    >
      <View
        style={{
          width: `${Math.round(Math.min(1, Math.max(0, props.pct)) * 100)}%`,
          height: h,
          borderRadius: h / 2,
          backgroundColor: props.color
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg, padding: spacing.l },
  btn: {
    paddingVertical: 14,
    paddingHorizontal: spacing.xl,
    borderRadius: radius.l,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: flat.outline,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4
  },
  btnLabel: { ...type.h2, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.l + 4,
    padding: spacing.l,
    borderWidth: 1,
    borderColor: colors.border,
    shadowColor: flat.outline,
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.5,
    shadowRadius: 0,
    elevation: 2
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border
  },
  statDot: {
    width: 7,
    height: 7,
    borderRadius: 4
  },
  statValue: {
    fontSize: 15,
    fontWeight: "900"
  }
});
