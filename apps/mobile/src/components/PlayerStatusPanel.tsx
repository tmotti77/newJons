/**
 * The "You" panel on the planning screen: who you are, your current job +
 * wage, and the four win-goal meters (Money / Happiness / Education / Career)
 * filling toward this game's targets — so you can see what you're doing and
 * how close you are to winning WHILE you plan. Fixes the "I don't know what's
 * going on" problem (the old cramped stat-chip strip).
 *
 * Uses the engine's own goalProgress() — the same math the server uses to
 * pick the winner — so the meters are the real win condition, not a guess.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { JOBS, goalProgress, type GameState, type PlayerState } from "@fastlane/engine";

import { colors, spacing, type as typo } from "../theme";
import { Avatar, Card, ProgressBar } from "./ui";

/** Thousands separators without Intl (Hermes ships a stubbed Intl). */
function grouped(n: number): string {
  return Math.floor(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function PlayerStatusPanel(props: {
  player: PlayerState;
  state: GameState;
  avatarId: string;
  name: string;
}) {
  const { player, state, avatarId, name } = props;
  const { t } = useTranslation();

  const gp = goalProgress(state, player);
  const goals = state.settings.goals;

  const jobDef = player.jobTier >= 0 ? JOBS.find((j) => j.tier === player.jobTier) : undefined;
  const jobLabel = jobDef ? t(jobDef.nameKey) : t("job.none");

  const meters = [
    {
      key: "money",
      icon: "💵",
      color: colors.cash,
      label: t("status.money"),
      cur: `₪${grouped(gp.netWorth)}`,
      target: `₪${grouped(goals.netWorth)}`,
      pct: gp.pct.netWorth
    },
    {
      key: "happiness",
      icon: "😊",
      color: colors.happiness,
      label: t("status.happiness"),
      cur: String(gp.happiness),
      target: String(goals.happiness),
      pct: gp.pct.happiness
    },
    {
      key: "education",
      icon: "🎓",
      color: colors.education,
      label: t("status.education"),
      cur: String(gp.courses),
      target: String(goals.courses),
      pct: gp.pct.courses
    },
    {
      key: "career",
      icon: "💼",
      color: colors.career,
      label: t("status.career"),
      cur: `T${gp.careerTier}`,
      target: `T${goals.careerTier}`,
      pct: gp.pct.careerTier
    }
  ] as const;

  return (
    <Card style={styles.card}>
      <View style={styles.header}>
        <Avatar id={avatarId} size={34} />
        <View style={styles.headerText}>
          <Text style={typo.h2} numberOfLines={1}>
            {name}
          </Text>
          <Text style={typo.dim} numberOfLines={1}>
            {jobLabel}
            {jobDef ? ` · ₪${jobDef.wagePerTU}/TU` : ""}
          </Text>
        </View>
        <View style={styles.cashBox}>
          <Text style={styles.cashValue}>₪{grouped(player.cash)}</Text>
          {!player.fedThisWeek ? (
            <Text style={styles.hungry}>🍽 {t("play.hungry")}</Text>
          ) : (
            <Text style={typo.tiny}>{t("status.cash")}</Text>
          )}
        </View>
      </View>

      <View style={styles.meters}>
        {meters.map((m) => (
          <View key={m.key} style={styles.meterRow}>
            <Text style={styles.meterIcon}>{m.icon}</Text>
            <Text style={[typo.tiny, styles.meterLabel]} numberOfLines={1}>
              {m.label}
            </Text>
            <View style={styles.meterBar}>
              <ProgressBar pct={m.pct} color={m.color} height={10} />
            </View>
            <Text style={[typo.tiny, styles.meterValue]} numberOfLines={1}>
              <Text style={{ color: m.color, fontWeight: "800" }}>{m.cur}</Text>
              <Text style={{ color: colors.textFaint }}> / {m.target}</Text>
            </Text>
          </View>
        ))}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { padding: spacing.m, gap: spacing.s },
  header: { flexDirection: "row", alignItems: "center", gap: spacing.s },
  headerText: { flex: 1, gap: 1 },
  cashBox: { alignItems: "flex-end" },
  cashValue: { ...typo.number, color: colors.cash },
  hungry: { ...typo.tiny, color: colors.danger, fontWeight: "800" },
  meters: { gap: spacing.xs },
  meterRow: { flexDirection: "row", alignItems: "center", gap: spacing.s },
  meterIcon: { fontSize: 14, width: 18, textAlign: "center" },
  meterLabel: { width: 62 },
  meterBar: { flex: 1 },
  meterValue: { width: 96, textAlign: "right" }
});
