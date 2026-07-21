/**
 * The town (§4.2 reskin): a flat-vector town — grass, a loop road, and 11
 * tappable buildings. Tapping auto-inserts travel and opens the action
 * sheet (handled by the caller via `onSelect`). Draws the player's
 * character at `current`'s building and, when a route is planned, a dashed
 * line tracing the stops in order.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Circle, G, Line, Path, Rect } from "react-native-svg";

import type { LocationId } from "@fastlane/engine";

import { colors, flat, radius } from "../theme";
import { Building } from "./Building";

type Pt = { x: number; y: number };

// The whole map is authored against this fixed design canvas. The Svg
// backdrop scales to the container width and buildings are positioned by
// the same percentages, so the two stay pixel-aligned at any device width.
const W = 360;
const H = 560;
const CENTER: Pt = { x: 180, y: 285 };
const BUILDING_SIZE = 58;

const ROAD = { x: 95, y: 75, width: 170, height: 420, rx: 75 };

// West zone on the left, east zone on the right, theSpot as a central
// plaza inside the loop — a legible, cute composition, not a scatter.
const LAYOUT: Record<LocationId, Pt> = {
  home: { x: 46, y: 90 },
  burgerBarn: { x: 46, y: 168 },
  quickMart: { x: 46, y: 246 },
  rentALord: { x: 46, y: 324 },
  flipIt: { x: 46, y: 402 },
  dressCode: { x: 46, y: 480 },
  college: { x: 314, y: 90 },
  gadgetCity: { x: 314, y: 220 },
  careerHub: { x: 314, y: 350 },
  bank: { x: 314, y: 480 },
  theSpot: { x: 180, y: 285 }
};

const LOCATION_IDS = Object.keys(LAYOUT) as LocationId[];

/** Nudges a point a fixed distance toward the plaza — used to stand the
 * player character just off the building, on the road side. */
function towardCenter(p: Pt, dist: number): Pt {
  const dx = CENTER.x - p.x;
  const dy = CENTER.y - p.y;
  const len = Math.hypot(dx, dy) || 1;
  return { x: p.x + (dx / len) * dist, y: p.y + (dy / len) * dist };
}

export function TownMap(props: {
  current: LocationId;
  onSelect: (loc: LocationId) => void;
  plannedTravels?: LocationId[];
}) {
  const { t } = useTranslation();
  const { current, onSelect, plannedTravels } = props;

  const route: Pt[] =
    plannedTravels && plannedTravels.length > 0
      ? [LAYOUT[current], ...plannedTravels.map((id) => LAYOUT[id])]
      : [];

  const player = towardCenter(LAYOUT[current], 32);

  return (
    <View style={styles.card}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} style={StyleSheet.absoluteFill}>
        <Rect x={0} y={0} width={W} height={H} fill={flat.grass} />

        {/* loop road */}
        <Rect
          x={ROAD.x}
          y={ROAD.y}
          width={ROAD.width}
          height={ROAD.height}
          rx={ROAD.rx}
          ry={ROAD.rx}
          fill="none"
          stroke={flat.road}
          strokeWidth={34}
        />
        <Rect
          x={ROAD.x}
          y={ROAD.y}
          width={ROAD.width}
          height={ROAD.height}
          rx={ROAD.rx}
          ry={ROAD.rx}
          fill="none"
          stroke="#FFF3D6"
          strokeWidth={2.5}
          strokeDasharray="10 10"
        />

        {/* planned route: dotted coral line through the stops, in order */}
        {route.slice(1).map((to, i) => {
          const from = route[i]!;
          return (
            <Line
              key={`route-${i}`}
              x1={from.x}
              y1={from.y}
              x2={to.x}
              y2={to.y}
              stroke={flat.coral}
              strokeWidth={3.5}
              strokeDasharray="8 7"
              strokeLinecap="round"
            />
          );
        })}

        {/* player character, standing just off their current building */}
        <G>
          <Circle
            cx={player.x}
            cy={player.y}
            r={17}
            fill="none"
            stroke={colors.primary}
            strokeWidth={2}
            strokeDasharray="3 4"
          />
          <Path
            d={`M ${player.x - 6} ${player.y + 11} Q ${player.x - 6} ${player.y - 1} ${player.x} ${player.y - 1} Q ${player.x + 6} ${player.y - 1} ${player.x + 6} ${player.y + 11} Z`}
            fill={colors.primary}
            stroke={flat.outline}
            strokeWidth={2}
            strokeLinejoin="round"
          />
          <Circle
            cx={player.x}
            cy={player.y - 7}
            r={6}
            fill={colors.primary}
            stroke={flat.outline}
            strokeWidth={2}
          />
        </G>
      </Svg>

      {LOCATION_IDS.map((id) => {
        const p = LAYOUT[id];
        const leftPct = (p.x / W) * 100;
        const topPct = (p.y / H) * 100;
        return (
          <View
            key={id}
            pointerEvents="box-none"
            style={[
              styles.pin,
              {
                left: `${leftPct}%`,
                top: `${topPct}%`,
                transform: [{ translateX: -BUILDING_SIZE / 2 }, { translateY: -BUILDING_SIZE / 2 }]
              }
            ]}
          >
            <Building
              id={id}
              label={t(`loc.${id}`)}
              onPress={() => onSelect(id)}
              highlighted={id === current}
              size={BUILDING_SIZE}
            />
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "100%",
    aspectRatio: W / H,
    borderRadius: radius.l,
    borderWidth: 3,
    borderColor: flat.outline,
    backgroundColor: flat.grass,
    overflow: "hidden"
  },
  pin: {
    position: "absolute"
  }
});
