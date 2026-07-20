/**
 * Reveal choreography (§4.3): week splash → global events → juicy player
 * cards → standings. Tap to advance; auto-advances too. Data read directly
 * from round_results (RLS allows players to read their game).
 */
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import type { EventCard, GoalProgress, LedgerLine } from "@fastlane/engine";

import { Avatar, Card, ProgressBar, Screen } from "../../../src/components/ui";
import { supabase } from "../../../src/lib/supabase";
import { useGameStore } from "../../../src/stores/gameStore";
import { colors, spacing, type } from "../../../src/theme";

interface ResultRow {
  players: {
    slot: number;
    ledger: LedgerLine[];
    eventCards: EventCard[];
    goalProgress: GoalProgress;
  }[];
  globalEvents: EventCard[];
  standings: number[];
  winnerSlot: number | null;
}

const STEP_MS = 3200;

/** Re-animates its content on every step change: fade in + rise, ≤300ms. */
function StepCard({ stepKey, children }: { stepKey: number; children: React.ReactNode }) {
  const progress = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    progress.setValue(0);
    Animated.timing(progress, {
      toValue: 1,
      duration: 260,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true
    }).start();
  }, [stepKey, progress]);
  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
          { scale: progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }
        ]
      }}
    >
      {children}
    </Animated.View>
  );
}

export default function Reveal() {
  const { t } = useTranslation();
  const { id, round } = useLocalSearchParams<{ id: string; round: string }>();
  const snapshot = useGameStore((s) => s.snapshot);
  const [results, setResults] = useState<ResultRow | null>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      // Bounded retry: the row is written before the next round is created,
      // but a transient read failure must not strand the player here.
      for (let attempt = 0; attempt < 10; attempt++) {
        const { data, error } = await supabase
          .from("round_results")
          .select("results")
          .eq("game_id", id)
          .eq("round_number", Number(round))
          .maybeSingle();
        if (cancelled) return;
        if (data?.results) {
          setResults(data.results as ResultRow);
          return;
        }
        if (error) console.warn(`reveal: round_results read failed: ${error.message}`);
        await new Promise((r) => setTimeout(r, 1000));
      }
      if (!cancelled) router.back();
    })();
    return () => {
      cancelled = true;
    };
  }, [id, round]);

  const steps = useMemo(() => {
    if (!results || !snapshot) return [];
    const nameOf = (slot: number) =>
      snapshot.players.find((p) => p.slot === slot)?.displayName ?? "?";
    const avatarOf = (slot: number) =>
      snapshot.players.find((p) => p.slot === slot)?.avatar ?? "a1";

    const cards: React.ReactNode[] = [];

    // 1. splash
    cards.push(
      <View key="splash" style={{ alignItems: "center", gap: spacing.m }}>
        <Text style={{ fontSize: 56 }}>📅</Text>
        <Text style={type.title}>{t("reveal.week", { n: round })}</Text>
      </View>
    );

    // 2. global events
    for (const ev of results.globalEvents) {
      cards.push(
        <Card key={ev.id} style={{ alignItems: "center", gap: spacing.m }}>
          <Text style={{ fontSize: 44 }}>🌆</Text>
          <Text style={[type.h1, { textAlign: "center" }]}>{t(ev.key, ev.params ?? {})}</Text>
        </Card>
      );
    }

    // 3. juicy player cards (biggest cash swing + all event cards)
    const swings = results.players
      .map((p) => ({
        slot: p.slot,
        earned: p.ledger.reduce((s, l) => s + Math.max(0, l.cashDelta ?? 0), 0),
        spent: p.ledger.reduce((s, l) => s + Math.min(0, l.cashDelta ?? 0), 0)
      }))
      .sort((a, b) => b.earned - a.earned);
    const topEarner = swings[0];
    if (topEarner && topEarner.earned > 0) {
      cards.push(
        <Card key="earner" style={{ alignItems: "center", gap: spacing.m }}>
          <Avatar id={avatarOf(topEarner.slot)} size={64} />
          <Text style={[type.h1, { textAlign: "center" }]}>
            {t("reveal.topEarner", { name: nameOf(topEarner.slot), amount: topEarner.earned })}
          </Text>
        </Card>
      );
    }
    const spender = [...swings].sort((a, b) => a.spent - b.spent)[0];
    if (spender && spender.spent < 0) {
      cards.push(
        <Card key="spender" style={{ alignItems: "center", gap: spacing.m }}>
          <Avatar id={avatarOf(spender.slot)} size={64} />
          <Text style={[type.h1, { textAlign: "center" }]}>
            {t("reveal.bigSpender", { name: nameOf(spender.slot), amount: -spender.spent })}
          </Text>
        </Card>
      );
    }
    // roast lines: biggest happiness swing each way (§2.6 social cards)
    const moods = results.players.map((p) => ({
      slot: p.slot,
      mood: p.ledger.reduce((s, l) => s + (l.happinessDelta ?? 0), 0)
    }));
    const saddest = [...moods].sort((a, b) => a.mood - b.mood)[0];
    if (saddest && saddest.mood <= -8) {
      cards.push(
        <Card key="roast-sad" style={{ alignItems: "center", gap: spacing.m }}>
          <Avatar id={avatarOf(saddest.slot)} size={64} />
          <Text style={[type.h1, { textAlign: "center" }]}>
            {t("reveal.roastSad", { name: nameOf(saddest.slot), amount: -saddest.mood })}
          </Text>
        </Card>
      );
    }
    const happiest = [...moods].sort((a, b) => b.mood - a.mood)[0];
    if (happiest && happiest.mood >= 8 && happiest.slot !== saddest?.slot) {
      cards.push(
        <Card key="roast-happy" style={{ alignItems: "center", gap: spacing.m }}>
          <Avatar id={avatarOf(happiest.slot)} size={64} />
          <Text style={[type.h1, { textAlign: "center" }]}>
            {t("reveal.roastHappy", { name: nameOf(happiest.slot), amount: happiest.mood })}
          </Text>
        </Card>
      );
    }

    for (const p of results.players) {
      for (const ev of p.eventCards.slice(0, 2)) {
        cards.push(
          <Card key={ev.id} style={{ alignItems: "center", gap: spacing.m }}>
            <Avatar id={avatarOf(p.slot)} size={64} />
            <Text style={[type.h1, { textAlign: "center" }]}>
              {nameOf(p.slot)}: {t(ev.key, ev.params ?? {})}
            </Text>
          </Card>
        );
      }
    }

    // 4. standings
    cards.push(
      <Card key="standings" style={{ gap: spacing.m }}>
        <Text style={[type.h1, { textAlign: "center" }]}>{t("reveal.standings")}</Text>
        {results.standings.map((slot, i) => {
          const p = results.players.find((x) => x.slot === slot);
          if (!p) return null;
          return (
            <View key={slot} style={{ flexDirection: "row", alignItems: "center", gap: spacing.m }}>
              <Text style={[type.h2, { width: 28 }]}>{i + 1}.</Text>
              <Avatar id={avatarOf(slot)} size={36} />
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={type.body}>{nameOf(slot)}</Text>
                <ProgressBar pct={p.goalProgress.score / 4} color={colors.primary} />
              </View>
              <Text style={type.number}>{Math.round((p.goalProgress.score / 4) * 100)}%</Text>
            </View>
          );
        })}
      </Card>
    );
    return cards;
  }, [results, snapshot, round, t]);

  // auto-advance; done → back to play
  useEffect(() => {
    if (steps.length === 0) return;
    if (step >= steps.length) {
      router.back();
      return;
    }
    const timer = setTimeout(() => setStep((s) => s + 1), STEP_MS);
    return () => clearTimeout(timer);
  }, [step, steps.length]);

  return (
    <Pressable
      style={{ flex: 1 }}
      onPress={() => (steps.length === 0 ? router.back() : setStep((s) => s + 1))}
    >
      <Screen style={{ justifyContent: "center", gap: spacing.xl }}>
        {steps.length === 0 ? (
          <Text style={[type.dim, { textAlign: "center" }]}>{t("common.loading")}</Text>
        ) : (
          <StepCard stepKey={Math.min(step, steps.length - 1)}>
            {steps[Math.min(step, steps.length - 1)]}
          </StepCard>
        )}
        <View style={{ flexDirection: "row", justifyContent: "center", gap: 6 }}>
          {steps.map((_, i) => (
            <View
              key={i}
              style={{
                width: 8,
                height: 8,
                borderRadius: 4,
                backgroundColor: i <= step ? colors.primary : colors.border
              }}
            />
          ))}
        </View>
        <Text style={[type.tiny, { textAlign: "center" }]}>{t("reveal.tapToContinue")}</Text>
      </Screen>
    </Pressable>
  );
}
