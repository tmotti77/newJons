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

import { AVATARS, colors, radius, spacing, type } from "../theme";

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
        variant === "secondary" && { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border },
        variant === "ghost" && { backgroundColor: "transparent" },
        variant === "danger" && { backgroundColor: colors.danger },
        (disabled || loading) && { opacity: 0.45 },
        pressed && { transform: [{ scale: 0.98 }] },
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
  return (
    <View style={styles.statChip}>
      <Text style={{ fontSize: 14 }}>{props.icon}</Text>
      <Text style={[type.number, { fontSize: 14, color: props.color ?? colors.text }]}>
        {props.value}
      </Text>
      {props.label ? <Text style={type.tiny}>{props.label}</Text> : null}
    </View>
  );
}

export function ProgressBar(props: { pct: number; color: string; height?: number }) {
  const h = props.height ?? 8;
  return (
    <View style={{ height: h, borderRadius: h / 2, backgroundColor: colors.bgElevated, overflow: "hidden" }}>
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
    borderRadius: radius.m,
    alignItems: "center",
    justifyContent: "center"
  },
  btnLabel: { ...type.h2, color: colors.text },
  card: {
    backgroundColor: colors.card,
    borderRadius: radius.l,
    padding: spacing.l,
    borderWidth: 1,
    borderColor: colors.border
  },
  statChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.bgElevated,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: radius.pill
  }
});
