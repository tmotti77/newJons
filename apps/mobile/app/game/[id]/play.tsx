/**
 * THE main screen (§4.2): stats strip, countdown, town map, plan tray,
 * submit. A full week plannable in <60s with one thumb.
 */
import { router, useLocalSearchParams } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import { Alert, Pressable, ScrollView, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import { JOBS, totalCourses, travelCost, type LocationId } from "@fastlane/engine";

import { Countdown } from "../../../src/components/Countdown";
import { LocationSheet } from "../../../src/components/LocationSheet";
import { PlanTray } from "../../../src/components/PlanTray";
import { TownMap } from "../../../src/components/TownMap";
import { Avatar, Button, Screen, StatChip } from "../../../src/components/ui";
import { api } from "../../../src/lib/api";
import { useGameChannel } from "../../../src/lib/realtime";
import { toActionInput, useGameStore } from "../../../src/stores/gameStore";
import { colors, spacing, type } from "../../../src/theme";

export default function Play() {
  const { t } = useTranslation();
  const { id } = useLocalSearchParams<{ id: string }>();
  useGameChannel(id ?? null);

  const snapshot = useGameStore((s) => s.snapshot);
  const planDraft = useGameStore((s) => s.planDraft);
  const addAction = useGameStore((s) => s.addAction);
  const removeAction = useGameStore((s) => s.removeAction);
  const clearGame = useGameStore((s) => s.clearGame);
  const submitted = useGameStore((s) => s.submitted);
  const submitting = useGameStore((s) => s.submitting);
  const setSubmitted = useGameStore((s) => s.setSubmitted);
  const setSubmitting = useGameStore((s) => s.setSubmitting);
  const engineState = useGameStore((s) => s.engineState)();
  const myState = useGameStore((s) => s.myState)();
  const validation = useGameStore((s) => s.validation)();

  const [sheet, setSheet] = useState<LocationId | null>(null);
  const [lastWeekSeen, setLastWeekSeen] = useState(0);

  // Route transitions: finished game → over; new resolved round → reveal.
  useEffect(() => {
    if (!snapshot || snapshot.game.id !== id) return;
    if (snapshot.game.status === "finished") {
      router.replace(`/game/${id}/over` as never);
      return;
    }
    const round = snapshot.round;
    if (round && round.roundNumber > 1 && round.roundNumber > lastWeekSeen) {
      setLastWeekSeen(round.roundNumber);
      // A new round means the previous one resolved → show the reveal.
      if (round.roundNumber > 1) {
        router.push({
          pathname: `/game/${id}/reveal`,
          params: { round: String(round.roundNumber - 1) }
        } as never);
      }
    }
  }, [snapshot, id, lastWeekSeen]);

  const planLocation = useMemo<LocationId>(() => {
    // Where the plan currently "ends" — travel context for the next action.
    let loc = (myState?.location ?? "home") as LocationId;
    for (const a of planDraft) if (a.type === "travel") loc = a.to;
    return loc;
  }, [planDraft, myState]);

  if (!snapshot || !engineState || !myState || snapshot.game.id !== id) {
    return (
      <Screen style={{ justifyContent: "center" }}>
        <Text style={[type.dim, { textAlign: "center" }]}>{t("common.loading")}</Text>
      </Screen>
    );
  }

  const round = snapshot.round;
  const week = snapshot.game.globalState?.week ?? round?.roundNumber ?? 1;
  const courses = totalCourses(myState);
  const jobName =
    myState.jobTier >= 0
      ? t(JOBS.find((j) => j.tier === Math.max(0, myState.jobTier))!.nameKey)
      : t("job.none");

  const selectLocation = (loc: LocationId) => {
    if (loc !== planLocation) {
      const player = { ...myState, location: planLocation };
      addAction({ type: "travel", to: loc });
      void travelCost(player, planLocation, loc);
    }
    setSheet(loc);
  };

  const submit = async () => {
    if (!round) return;
    setSubmitting(true);
    try {
      await api.submitPlan(snapshot.game.id, round.roundNumber, planDraft.map(toActionInput));
      setSubmitted(true);
    } catch {
      // validation errors already highlighted; stale round refetches via doorbell
    } finally {
      setSubmitting(false);
    }
  };

  const onExpire = () => {
    if (round) void api.resolveRound(snapshot.game.id, round.roundNumber).catch(() => undefined);
  };

  const leave = () => {
    Alert.alert(t("play.leaveTitle"), t("play.leaveBody"), [
      { text: t("common.cancel"), style: "cancel" },
      {
        text: t("play.leaveConfirm"),
        style: "destructive",
        onPress: () => {
          void api.leaveGame(snapshot.game.id).catch(() => undefined);
          clearGame();
          router.replace("/");
        }
      }
    ]);
  };

  return (
    <Screen style={{ gap: spacing.m, paddingBottom: spacing.xl }}>
      {/* top bar */}
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
        <Text style={type.h1}>{t("play.week", { n: week })}</Text>
        <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.m }}>
          <View style={{ flexDirection: "row", gap: 6 }}>
            {snapshot.players.map((p) => (
              <Avatar key={p.playerId} id={p.avatar} size={26} dim={!p.isConnected} />
            ))}
          </View>
          <Pressable
            onPress={leave}
            accessibilityLabel={t("play.leaveTitle")}
            accessibilityRole="button"
            hitSlop={12}
            style={({ pressed }) => ({ opacity: pressed ? 0.6 : 1, padding: spacing.xs })}
          >
            <Text style={{ fontSize: 20 }}>🚪</Text>
          </Pressable>
        </View>
      </View>

      {round ? (
        <Countdown
          endsAt={round.endsAt}
          totalSeconds={snapshot.game.settings.planTimerSeconds}
          onExpire={onExpire}
        />
      ) : null}

      {/* stats strip */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: spacing.s }}
        style={{ flexGrow: 0 }}
      >
        <StatChip icon="💵" value={`₪${Math.floor(myState.cash)}`} color={colors.cash} />
        <StatChip icon="🏦" value={`₪${Math.floor(myState.bankBalance)}`} />
        <StatChip icon="😊" value={String(myState.happiness)} color={colors.happiness} />
        <StatChip icon="🎓" value={String(courses)} color={colors.education} />
        <StatChip icon="💼" value={jobName} color={colors.career} />
        <StatChip
          icon={myState.fedThisWeek ? "🍽" : "🍽❗"}
          value={myState.fedThisWeek ? t("play.fed") : t("play.hungry")}
        />
      </ScrollView>

      {/* town */}
      <ScrollView contentContainerStyle={{ paddingBottom: spacing.m }}>
        <TownMap current={planLocation} onSelect={selectLocation} />
      </ScrollView>

      {/* tray + submit */}
      <PlanTray plan={planDraft} validation={validation} onRemove={removeAction} />
      {submitted ? (
        <View style={{ gap: spacing.s }}>
          <Text style={[type.h2, { textAlign: "center", color: colors.success }]}>
            ✓ {t("play.submittedWaiting")}
          </Text>
          <Button
            label={t("play.changePlan")}
            variant="ghost"
            onPress={() => setSubmitted(false)}
          />
        </View>
      ) : (
        <Button
          label={t("play.submit")}
          onPress={() => void submit()}
          loading={submitting}
          disabled={!validation?.ok || !round}
        />
      )}

      <LocationSheet
        location={sheet}
        engineState={engineState}
        player={{ ...myState, location: planLocation }}
        projectedCash={validation?.projected?.cash ?? myState.cash}
        onAdd={(actions) => {
          actions.forEach((a) => addAction(a));
          setSheet(null);
        }}
        onClose={() => setSheet(null)}
      />
    </Screen>
  );
}
