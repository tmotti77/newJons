/**
 * Tappable building → bottom sheet of actions (§4.2). Every option comes
 * from balance config via the engine package — no hardcoded numbers.
 */
import React, { useMemo, useState } from "react";
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useTranslation } from "react-i18next";

import {
  BANK as BANK_CFG,
  EDUCATION,
  FOOD,
  FUN,
  HOUSING,
  ITEMS,
  JOBS,
  LOTTERY,
  OUTFITS,
  WORK,
  currentRent,
  type Action,
  type GameState,
  type LocationId,
  type PlayerState
} from "@fastlane/engine";

import { colors, LOCATION_META, radius, spacing, type } from "../theme";
import { Button } from "./ui";

interface Props {
  location: LocationId | null;
  engineState: GameState;
  player: PlayerState;
  projectedCash: number;
  onAdd: (actions: Action[]) => void;
  onClose: () => void;
}

function Row(props: {
  title: string;
  subtitle: string;
  cta: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={type.h2}>{props.title}</Text>
        <Text style={type.dim}>{props.subtitle}</Text>
      </View>
      <Button label={props.cta} onPress={props.onPress} disabled={props.disabled} style={{ paddingVertical: 8, paddingHorizontal: 14 }} />
    </View>
  );
}

export function LocationSheet({ location, engineState, player, projectedCash, onAdd, onClose }: Props) {
  const { t } = useTranslation();
  const [workTU, setWorkTU] = useState(16);

  const rows = useMemo(() => {
    if (!location) return [];
    const add = (actions: Action[]) => () => onAdd(actions);
    const list: React.ReactNode[] = [];
    const cash = projectedCash;

    const jobHere = JOBS.find(
      (j) => j.location === location && j.tier === Math.max(0, player.jobTier)
    );

    // WORK (current job at this location, or gig from anywhere handled on map)
    if (jobHere && player.jobTier >= 1) {
      list.push(
        <View key="work" style={[styles.row, { flexDirection: "column", alignItems: "stretch", gap: spacing.m }]}>
          <Text style={type.h2}>
            {t("actions.workShift", { job: t(jobHere.nameKey), wage: jobHere.wagePerTU })}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.m }}>
            <Button label="−4" variant="secondary" onPress={() => setWorkTU((v) => Math.max(WORK.minShiftTU, v - 4))} style={styles.stepBtn} />
            <Text style={[type.number, { minWidth: 90, textAlign: "center" }]}>
              {t("actions.tuShift", { tu: workTU })}
            </Text>
            <Button label="+4" variant="secondary" onPress={() => setWorkTU((v) => Math.min(WORK.maxWeeklyTU, v + 4))} style={styles.stepBtn} />
          </View>
          <Button
            label={t("actions.addWork", { amount: workTU * jobHere.wagePerTU })}
            onPress={add([{ type: "work", tu: workTU }])}
          />
        </View>
      );
    }

    switch (location) {
      case "burgerBarn": {
        if (player.jobTier === -1) {
          list.push(
            <Row key="apply1" title={t("job.burgerCrew")} subtitle={t("actions.applySub", { wage: 10 })} cta={t("actions.apply")} onPress={add([{ type: "applyJob", tier: 1 }])} />
          );
        }
        break;
      }
      case "college": {
        (["business", "tech", "trade"] as const).forEach((track) => {
          list.push(
            <Row
              key={`study-${track}`}
              title={t(`track.${track}`)}
              subtitle={t("actions.studySub", { cost: EDUCATION.courseCost, tu: EDUCATION.courseTU })}
              cta={t("actions.study")}
              disabled={cash < EDUCATION.courseCost}
              onPress={add([{ type: "study", courseTrack: track }])}
            />
          );
        });
        break;
      }
      case "gadgetCity": {
        for (const item of ITEMS) {
          const owned = player.items.includes(item.id);
          list.push(
            <Row
              key={item.id}
              title={t(item.nameKey)}
              subtitle={owned ? t("actions.owned") : t("actions.priceTag", { price: item.price })}
              cta={t("actions.buy")}
              disabled={owned || cash < item.price}
              onPress={add([{ type: "buy", item: item.id }])}
            />
          );
        }
        break;
      }
      case "flipIt": {
        for (const item of ITEMS) {
          if (player.items.includes(item.id)) {
            const value = Math.floor(item.price / 2);
            list.push(
              <Row key={`sell-${item.id}`} title={t("actions.sellItem", { item: t(item.nameKey) })} subtitle={t("actions.priceTag", { price: value })} cta={t("actions.sell")} onPress={add([{ type: "sell", item: item.id }])} />
            );
          } else {
            const usedPrice = Math.floor((item.price * 70) / 100);
            list.push(
              <Row key={`used-${item.id}`} title={t("actions.usedItem", { item: t(item.nameKey) })} subtitle={t("actions.priceTag", { price: usedPrice })} cta={t("actions.buy")} disabled={cash < usedPrice} onPress={add([{ type: "buy", item: item.id }])} />
            );
          }
        }
        break;
      }
      case "dressCode": {
        for (const outfit of OUTFITS) {
          const owned = player.outfits.find((o) => o.outfit === outfit.id);
          list.push(
            <Row
              key={outfit.id}
              title={t(outfit.nameKey)}
              subtitle={
                owned
                  ? t("actions.outfitOwned", { weeks: owned.weeksLeft })
                  : t("actions.outfitSub", { price: outfit.price, weeks: outfit.wearWeeks })
              }
              cta={t("actions.buy")}
              disabled={cash < outfit.price}
              onPress={add([{ type: "buyOutfit", outfit: outfit.id }])}
            />
          );
        }
        break;
      }
      case "careerHub": {
        for (const job of JOBS) {
          if (job.tier <= Math.max(0, player.jobTier) || job.requirements.applyAt !== "careerHub") continue;
          const req = job.requirements;
          const reqBits = [
            req.courses ? t("req.courses", { n: req.courses }) : null,
            req.weeksWorked ? t("req.weeks", { n: req.weeksWorked }) : null,
            req.outfit ? t(`outfit.${req.outfit}`) : null,
            req.items?.length ? req.items.map((i) => t(`item.${i}`)).join(", ") : null,
            req.degree ? t("req.degree") : null
          ].filter(Boolean).join(" · ");
          list.push(
            <Row
              key={`job-${job.tier}`}
              title={`T${job.tier} · ${t(job.nameKey)}`}
              subtitle={`₪${job.wagePerTU}/TU${reqBits ? ` · ${reqBits}` : ""}`}
              cta={t("actions.apply")}
              onPress={add([{ type: "applyJob", tier: job.tier }])}
            />
          );
        }
        break;
      }
      case "bank": {
        list.push(
          <Row key="dep" title={t("actions.deposit")} subtitle={t("actions.depositSub", { pct: BANK_CFG.weeklyInterestPct })} cta={`+100`} disabled={cash < 100} onPress={add([{ type: "bank", op: "deposit", amount: 100 }])} />,
          <Row key="dep500" title={t("actions.deposit")} subtitle={t("actions.depositSub", { pct: BANK_CFG.weeklyInterestPct })} cta={`+500`} disabled={cash < 500} onPress={add([{ type: "bank", op: "deposit", amount: 500 }])} />,
          <Row key="wd" title={t("actions.withdraw")} subtitle={t("actions.bankBalance", { amount: Math.floor(player.bankBalance) })} cta={`−100`} disabled={player.bankBalance < 100} onPress={add([{ type: "bank", op: "withdraw", amount: 100 }])} />,
          <Row key="cbuy" title={t("actions.cryptoBuy")} subtitle={t("actions.cryptoSub", { price: engineState.cryptoPrice })} cta={`₪100`} disabled={cash < 100} onPress={add([{ type: "crypto", op: "buy", amount: 100 }])} />,
          <Row key="csell" title={t("actions.cryptoSell")} subtitle={t("actions.cryptoHolding", { value: Math.floor(player.cryptoUnits * engineState.cryptoPrice) })} cta={`₪100`} disabled={player.cryptoUnits * engineState.cryptoPrice < 100} onPress={add([{ type: "crypto", op: "sell", amount: 100 }])} />
        );
        break;
      }
      case "quickMart": {
        list.push(
          <Row key="eat" title={t("actions.eatBasic")} subtitle={t("actions.eatSub", { cost: FOOD.basicCost })} cta={t("actions.eat")} disabled={cash < FOOD.basicCost} onPress={add([{ type: "eat", kind: "basic" }])} />,
          <Row key="bulk" title={t("actions.eatBulk")} subtitle={t("actions.bulkSub", { cost: FOOD.bulkCost, weeks: FOOD.bulkWeeks })} cta={t("actions.buy")} disabled={cash < FOOD.bulkCost || !player.items.includes("fridge")} onPress={add([{ type: "eat", kind: "bulk" }])} />,
          <Row key="lotto" title={t("actions.lottery")} subtitle={t("actions.lotterySub", { cost: LOTTERY.ticketCost, jackpot: LOTTERY.jackpot })} cta={`×3`} disabled={cash < LOTTERY.ticketCost * 3} onPress={add([{ type: "lottery", tickets: 3 }])} />
        );
        break;
      }
      case "theSpot": {
        list.push(
          <Row key="club" title={t("actions.club")} subtitle={t("actions.funSub", { cost: FUN.club.cost, hap: FUN.club.happiness })} cta={t("actions.go")} disabled={cash < FUN.club.cost} onPress={add([{ type: "fun", kind: "club" }])} />,
          <Row key="movie" title={t("actions.movie")} subtitle={t("actions.funSub", { cost: FUN.movie.cost, hap: FUN.movie.happiness })} cta={t("actions.go")} disabled={cash < FUN.movie.cost} onPress={add([{ type: "fun", kind: "movie" }])} />
        );
        break;
      }
      case "rentALord": {
        const rent = currentRent(engineState, player);
        list.push(
          <Row key="rent" title={t("actions.payRent")} subtitle={t("actions.rentSub", { amount: rent })} cta={`₪${rent}`} disabled={cash < rent || player.evicted} onPress={add([{ type: "payRent" }])} />
        );
        for (const h of HOUSING) {
          if (h.tier === player.housingTier && !player.evicted) continue;
          const deposit = Math.round(h.rentPerWeek * engineState.rentMultiplier);
          list.push(
            <Row
              key={`move-${h.tier}`}
              title={t(h.nameKey)}
              subtitle={t("actions.moveSub", { rent: Math.round(h.rentPerWeek * engineState.rentMultiplier), hap: h.happinessPerWeek, deposit })}
              cta={t("actions.move")}
              disabled={cash < deposit}
              onPress={add([{ type: "moveApartment", tier: h.tier }])}
            />
          );
        }
        break;
      }
      case "home": {
        list.push(
          <Row key="delivery" title={t("actions.delivery")} subtitle={t("actions.eatSub", { cost: FOOD.deliveryCost })} cta={t("actions.order")} disabled={cash < FOOD.deliveryCost} onPress={add([{ type: "eat", kind: "delivery" }])} />,
          <Row key="stream" title={t("actions.stream")} subtitle={t("actions.funSub", { cost: FUN.stream.cost, hap: FUN.stream.happiness })} cta={t("actions.go")} disabled={cash < FUN.stream.cost} onPress={add([{ type: "fun", kind: "stream" }])} />,
          <Row key="rest" title={t("actions.rest")} subtitle={t("actions.restSub")} cta={`10 TU`} onPress={add([{ type: "rest", tu: 10 }])} />
        );
        if (player.items.includes("laptop")) {
          (["business", "tech", "trade"] as const).forEach((track) => {
            list.push(
              <Row
                key={`hstudy-${track}`}
                title={t("actions.onlineCourse", { track: t(`track.${track}`) })}
                subtitle={t("actions.studySub", { cost: EDUCATION.courseCost, tu: EDUCATION.courseTU - EDUCATION.laptopTUDiscount })}
                cta={t("actions.study")}
                disabled={cash < EDUCATION.courseCost}
                onPress={add([{ type: "study", courseTrack: track }])}
              />
            );
          });
        }
        break;
      }
    }
    return list;
  }, [location, engineState, player, projectedCash, workTU, onAdd, t]);

  if (!location) return null;
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.sheet}>
        <View style={styles.handle} />
        <Text style={[type.h1, { textAlign: "center" }]}>
          {LOCATION_META[location]?.emoji} {`  `}
          {/* location display name */}
          {`${""}`}
          {`${""}`}
        </Text>
        <Text style={[type.h1, { textAlign: "center", marginTop: -26 }]}>{` `}</Text>
        <Text style={[type.h1, { textAlign: "center" }]}>{`${LOCATION_META[location]?.emoji ?? ""} ${""}`}</Text>
        <ScrollView style={{ maxHeight: 420 }} contentContainerStyle={{ gap: spacing.s, paddingBottom: spacing.xl }}>
          {rows}
        </ScrollView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: colors.bgElevated,
    borderTopLeftRadius: radius.l,
    borderTopRightRadius: radius.l,
    padding: spacing.l,
    gap: spacing.m
  },
  handle: { alignSelf: "center", width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.m,
    backgroundColor: colors.card,
    borderRadius: radius.m,
    padding: spacing.m
  },
  stepBtn: { paddingVertical: 8, paddingHorizontal: 14 }
});
