/**
 * The town (§4.2 reskin): a flat-vector town — grass, a loop road, and 11
 * tappable buildings. Tapping auto-inserts travel and the caller opens the
 * action sheet when the character arrives (`onArrive`). The planned route is
 * traced along the same road the character walks, so preview and walk agree.
 */
import React, { useMemo, useState } from "react";
import { LayoutChangeEvent, StyleSheet, View } from "react-native";
import { useTranslation } from "react-i18next";
import Svg, { Path, Rect } from "react-native-svg";

import type { LocationId } from "@fastlane/engine";

import { flat, radius } from "../theme";
import {
  BUILDING_SIZE,
  H,
  LAYOUT,
  LOCATION_IDS,
  ROAD,
  W,
  toSvgPath,
  walkPath,
  type Pt
} from "../town/geometry";
import { Building } from "./Building";
import { Walker } from "./Walker";

export function TownMap(props: {
  /** Where the player actually is right now. */
  origin: LocationId;
  onSelect: (loc: LocationId) => void;
  /** Travel destinations queued this week, in order. */
  plannedTravels?: LocationId[];
  /** Fires when the character finishes walking to a stop. */
  onArrive?: (loc: LocationId) => void;
  /** Change to teleport rather than walk (new week). */
  snapKey?: string | number;
}) {
  const { t } = useTranslation();
  const { origin, onSelect, plannedTravels, onArrive, snapKey } = props;

  const [width, setWidth] = useState(0);
  const scale = width / W;

  const travels = plannedTravels ?? [];
  const travelKey = travels.join("|");

  /** Where the plan leaves you — that's who the map highlights and the walker chases. */
  const dest = travels.length > 0 ? travels[travels.length - 1]! : origin;

  const routeD = useMemo(() => {
    const stops: LocationId[] = [origin, ...travels];
    if (stops.length < 2) return "";

    const pts: Pt[] = [];
    for (let i = 1; i < stops.length; i++) {
      const leg = walkPath(stops[i - 1]!, stops[i]!);
      // Drop the repeated join point so the dashes don't double up.
      pts.push(...(i === 1 ? leg : leg.slice(1)));
    }
    return toSvgPath(pts);
    // Keyed on travelKey, not `travels` — the array is rebuilt every render, so
    // depending on it directly would defeat the memo entirely.
  }, [origin, travelKey]);

  const onLayout = (e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width);

  return (
    <View style={styles.card} onLayout={onLayout}>
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

        {/* planned route, traced along the road the character will actually walk */}
        {routeD ? (
          <Path
            d={routeD}
            fill="none"
            stroke={flat.coral}
            strokeWidth={3.5}
            strokeDasharray="8 7"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}
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
              highlighted={id === dest}
              size={BUILDING_SIZE}
            />
          </View>
        );
      })}

      <Walker to={dest} scale={scale} snapKey={snapKey} onArrive={onArrive} />
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
