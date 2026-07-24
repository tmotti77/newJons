/**
 * The player character walking the town (§4.2).
 *
 * Position is a single Animated.Value on the native driver, mapped onto a
 * resampled polyline via interpolate() — so following the road costs no JS per
 * frame, which is how this stays smooth without Reanimated.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AccessibilityInfo, Animated, Easing, StyleSheet } from "react-native";
import Svg, { Circle, Path } from "react-native-svg";

import type { LocationId } from "@fastlane/engine";

import { colors, flat } from "../theme";
import {
  pathLength,
  resample,
  standPoint,
  walkDurationMs,
  walkPath,
  type Pt
} from "../town/geometry";

/** Character box, in canvas units. */
const SIZE = 34;
/** Points handed to interpolate() per leg — a native config payload; keep small. */
const SAMPLES = 24;
/** A tap mid-walk collapses the queue and rushes the leg already in flight. */
const INTERRUPT_SPEEDUP = 3;
const MIN_RUSH_MS = 60;

export function Walker(props: {
  /** Where the character should end up — normally the end of the planned route. */
  to: LocationId;
  /** Canvas units → pixels. */
  scale: number;
  /** Change this to teleport instead of walk (mount, new week). */
  snapKey?: string | number;
  onArrive?: (loc: LocationId) => void;
}) {
  const { to, scale, snapKey, onArrive } = props;

  const t = useRef(new Animated.Value(1)).current;
  const bob = useRef(new Animated.Value(0)).current;

  const standingAt = useRef<LocationId>(to);
  const legDest = useRef<LocationId>(to);
  const legDuration = useRef(0);
  const pending = useRef<LocationId | null>(null);
  const running = useRef(false);
  const reduceMotion = useRef(false);

  const [path, setPath] = useState<Pt[]>(() => [standPoint(to)]);

  const onArriveRef = useRef(onArrive);
  useEffect(() => {
    onArriveRef.current = onArrive;
  }, [onArrive]);

  const startLegRef = useRef<(dest: LocationId) => void>(() => undefined);

  useEffect(() => {
    let alive = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (alive) reduceMotion.current = enabled;
    });
    const sub = AccessibilityInfo.addEventListener("reduceMotionChanged", (enabled) => {
      reduceMotion.current = enabled;
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, []);

  /** Idle breathing — cheap, native, and it stops the figure looking dead. */
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(bob, {
          toValue: 1,
          duration: 280,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        }),
        Animated.timing(bob, {
          toValue: 0,
          duration: 280,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true
        })
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [bob]);

  const snapTo = useCallback(
    (dest: LocationId) => {
      t.stopAnimation();
      running.current = false;
      pending.current = null;
      standingAt.current = dest;
      legDest.current = dest;
      setPath([standPoint(dest)]);
      t.setValue(1);
    },
    [t]
  );

  const completeLeg = useCallback(() => {
    running.current = false;
    standingAt.current = legDest.current;
    const queued = pending.current;
    pending.current = null;
    if (queued && queued !== standingAt.current) startLegRef.current(queued);
    else onArriveRef.current?.(standingAt.current);
  }, []);

  const startLeg = useCallback(
    (dest: LocationId) => {
      const next = walkPath(standingAt.current, dest);
      const duration = walkDurationMs(pathLength(next));

      legDest.current = dest;
      legDuration.current = duration;
      running.current = true;
      setPath(next);
      t.setValue(0);

      Animated.timing(t, {
        toValue: 1,
        duration,
        easing: Easing.inOut(Easing.quad),
        useNativeDriver: true
      }).start(({ finished }) => {
        // Not finished means we interrupted it on purpose — that path completes it.
        if (finished) completeLeg();
      });
    },
    [completeLeg, t]
  );

  useEffect(() => {
    startLegRef.current = startLeg;
  }, [startLeg]);

  useEffect(() => {
    if (standingAt.current === to && !running.current) return;

    if (reduceMotion.current) {
      snapTo(to);
      onArriveRef.current?.(to);
      return;
    }

    if (!running.current) {
      startLeg(to);
      return;
    }

    // Mid-walk: remember where we're really headed, then rush the current leg so
    // fast tapping catches up instead of turning into a slideshow.
    pending.current = to;
    t.stopAnimation((value: number) => {
      const remaining = Math.max(
        MIN_RUSH_MS,
        ((1 - value) * legDuration.current) / INTERRUPT_SPEEDUP
      );
      Animated.timing(t, {
        toValue: 1,
        duration: remaining,
        easing: Easing.linear,
        useNativeDriver: true
      }).start(({ finished }) => {
        if (finished) completeLeg();
      });
    });
    // Deliberately keyed on `to` alone: startLeg/snapTo are stable, and a
    // re-run for any other reason would restart the walk from the top.
  }, [to]);

  // Declared last so that when a new week changes both props at once, the snap
  // wins over any walk the destination change just started.
  useEffect(() => {
    snapTo(to);
    // Keyed on snapKey alone — this is the teleport, and it must not re-fire
    // when `to` changes or it would cancel every legitimate walk.
  }, [snapKey]);

  const samples = useMemo(() => resample(path, SAMPLES), [path]);
  const inputRange = useMemo(
    () => Array.from({ length: SAMPLES }, (_, i) => i / (SAMPLES - 1)),
    []
  );

  const translateX = useMemo(
    () => t.interpolate({ inputRange, outputRange: samples.map((p) => p.x * scale) }),
    [inputRange, samples, scale, t]
  );
  const translateY = useMemo(
    () => t.interpolate({ inputRange, outputRange: samples.map((p) => p.y * scale) }),
    [inputRange, samples, scale, t]
  );
  const bobY = useMemo(
    () => bob.interpolate({ inputRange: [0, 1], outputRange: [0, -1.5 * scale] }),
    [bob, scale]
  );

  /** One flip per leg — interpolating it would squash the sprite mid-turn. */
  const facing = useMemo(() => {
    if (path.length < 2) return 1;
    return path[path.length - 1]!.x >= path[0]!.x ? 1 : -1;
  }, [path]);

  if (scale <= 0) return null;

  const size = SIZE * scale;

  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.root,
        {
          width: size,
          height: size,
          marginLeft: -size / 2,
          marginTop: -size / 2,
          transform: [{ translateX }, { translateY }, { translateY: bobY }, { scaleX: facing }]
        }
      ]}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${SIZE} ${SIZE}`}>
        <Circle
          cx={17}
          cy={17}
          r={16}
          fill="none"
          stroke={colors.primary}
          strokeWidth={2}
          strokeDasharray="3 4"
        />
        <Path
          d="M 11 28 Q 11 16 17 16 Q 23 16 23 28 Z"
          fill={colors.primary}
          stroke={flat.outline}
          strokeWidth={2}
          strokeLinejoin="round"
        />
        <Circle cx={17} cy={10} r={6} fill={colors.primary} stroke={flat.outline} strokeWidth={2} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { position: "absolute", left: 0, top: 0 }
});
