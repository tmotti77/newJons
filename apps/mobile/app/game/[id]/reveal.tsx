/**
 * Reveal choreography (§4.3): week splash → global events → juicy player
 * cards → standings. Tap to advance; auto-advances too. Data read directly
 * from round_results (RLS allows players to read their game).
 */
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { Animated, Easing, Pressable, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { pickRevealCards } from "@fastlane/engine";
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

    // 2. juiciest moments — global events first, then the roast cards, all
    //    chosen by the tested engine picker (packages/engine/src/reveal.ts).
    //    The engine emits i18n keys + params by slot; we translate here and
    //    inject the player's display name (the engine only knows slots).
    const picked = pickRevealCards(results);
    picked.forEach((card, i) => {
      if (card.kind === "global") {
        cards.push(
          <Card key={`global-${i}`} style={{ alignItems: "center", gap: spacing.m }}>
            <Text style={{ fontSize: 44 }}>🌆</Text>
            <Text style={[type.h1, { textAlign: "center" }]}>{t(card.i18nKey, card.params)}</Text>
          </Card>
        );
      } else {
        cards.push(
          <Card key={`player-${i}`} style={{ alignItems: "center", gap: spacing.m }}>
            <Avatar id={avatarOf(card.slot)} size={64} />
            <Text style={[type.h1, { textAlign: "center" }]}>
              {t(card.i18nKey, { name: nameOf(card.slot), ...card.params })}
            </Text>
          </Card>
        );
      }
    });

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
