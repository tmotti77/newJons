/**
 * Distinct flat-vector icon per town location (spec §9.5).
 *
 * Hand-crafted marks on a 24x24 grid. Drawn in high-contrast cream on top of
 * the tile's brand colour (not tone-on-tone), with a dark outline and at most
 * one accent — so each mark still reads as itself at ~36px on a phone. Kept
 * deliberately low-detail: no hairline parallel lines, which are what turned to
 * mush at small sizes before.
 *
 * `Record<LocationId, ...>` guarantees at compile time that all 11 exist.
 */
import React from "react";
import Svg, { Circle, G, Line, Path, Polygon, Rect } from "react-native-svg";
import type { LocationId } from "@fastlane/engine";
import { flat } from "../theme";

const S = flat.outline; // dark outline
const F = "#FFF6E5"; // cream fill — the icon body, high-contrast on any tile

const ICONS: Record<LocationId, () => JSX.Element> = {
  home: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M2.5 11.5 L12 3 L21.5 11.5 Z" fill={flat.coral} />
      <Rect x={5} y={11.5} width={14} height={9.5} fill={F} />
      <Rect x={10} y={15} width={4} height={6} fill={S} stroke="none" />
      <Rect x={6.8} y={13.6} width={3} height={3} fill={flat.gold} strokeWidth={1.6} />
    </G>
  ),

  burgerBarn: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M3 11 Q3 4.5 12 4.5 Q21 4.5 21 11 Z" fill={flat.gold} />
      <Circle cx={9} cy={7.6} r={0.9} fill={F} stroke="none" />
      <Circle cx={14} cy={7} r={0.9} fill={F} stroke="none" />
      <Rect x={3} y={11} width={18} height={3.4} fill={S} stroke="none" />
      <Path d="M3 14.4 Q3 19.6 12 19.6 Q21 19.6 21 14.4 Z" fill={flat.gold} />
    </G>
  ),

  college: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M12 4.5 L22 9.5 L12 14.5 L2 9.5 Z" fill={F} />
      <Path d="M6.5 11.4 V15.5 Q6.5 18.2 12 18.2 Q17.5 18.2 17.5 15.5 V11.4" fill="none" />
      <Line x1={18.5} y1={11} x2={18.5} y2={16.5} />
      <Circle cx={18.5} cy={17} r={1.3} fill={flat.gold} />
    </G>
  ),

  gadgetCity: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Rect x={6.5} y={2.8} width={11} height={18.4} rx={2.6} fill={F} />
      <Rect x={8.4} y={5.8} width={7.2} height={10.6} rx={1} fill={S} stroke="none" />
      <Line x1={10.3} y1={4.4} x2={13.7} y2={4.4} strokeWidth={1.6} />
      <Circle cx={12} cy={18.8} r={1.1} fill={S} stroke="none" />
    </G>
  ),

  flipIt: () => (
    <G stroke={S} strokeWidth={2.4} strokeLinejoin="round" strokeLinecap="round">
      <Circle cx={12} cy={12.5} r={4} fill={flat.gold} strokeWidth={2} />
      <Path d="M12 4.5 A7.5 7.5 0 1 1 4.8 12.8" fill="none" />
      <Polygon points="12,1.6 15.4,5 11,5.4" fill={S} stroke="none" />
    </G>
  ),

  dressCode: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path
        d="M8.2 4 L4 7.6 L6.6 10.6 L8.6 9.1 V21 H15.4 V9.1 L17.4 10.6 L20 7.6 L15.8 4 Q13.9 6.2 12 6.2 Q10.1 6.2 8.2 4 Z"
        fill={F}
      />
      <Line x1={12} y1={6.4} x2={12} y2={12} strokeWidth={1.6} />
    </G>
  ),

  careerHub: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M9 8 V6.4 A3 3 0 0 1 15 6.4 V8" fill="none" />
      <Rect x={3} y={8} width={18} height={12} rx={2} fill={F} />
      <Line x1={3} y1={13.6} x2={21} y2={13.6} />
      <Rect x={10.4} y={12} width={3.2} height={3.2} fill={flat.gold} strokeWidth={1.6} />
    </G>
  ),

  bank: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M2 8 L12 2.5 L22 8 Z" fill={F} />
      <Circle cx={12} cy={6} r={1.2} fill={flat.gold} stroke="none" />
      <Rect x={4.5} y={10.4} width={15} height={7.2} fill={F} />
      <Line x1={9.5} y1={10.4} x2={9.5} y2={17.6} strokeWidth={2} />
      <Line x1={14.5} y1={10.4} x2={14.5} y2={17.6} strokeWidth={2} />
      <Rect x={2.5} y={18} width={19} height={2.6} fill={F} />
    </G>
  ),

  quickMart: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Path d="M2.5 4 H5 L6.6 7" fill="none" />
      <Polygon points="5.6,7 21,7 18.6,15 8,15" fill={F} />
      <Circle cx={9.6} cy={18.4} r={1.8} fill={S} stroke="none" />
      <Circle cx={17} cy={18.4} r={1.8} fill={S} stroke="none" />
    </G>
  ),

  theSpot: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Line x1={12} y1={1.5} x2={12} y2={5.2} />
      <Circle cx={12} cy={13} r={7.6} fill={flat.pink} />
      <Line x1={4.6} y1={13} x2={19.4} y2={13} strokeWidth={1.3} />
      <Line x1={12} y1={5.6} x2={12} y2={20.4} strokeWidth={1.3} />
      <Path d="M6.8 8.4 Q12 13 6.8 17.6" fill="none" strokeWidth={1.3} />
      <Path d="M17.2 8.4 Q12 13 17.2 17.6" fill="none" strokeWidth={1.3} />
    </G>
  ),

  rentALord: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round" strokeLinecap="round">
      <Rect x={5} y={2.5} width={14} height={19} fill={F} />
      <Rect x={7.3} y={5.4} width={3.6} height={3.6} fill={flat.gold} strokeWidth={1.5} />
      <Rect x={13.1} y={5.4} width={3.6} height={3.6} fill={flat.gold} strokeWidth={1.5} />
      <Rect x={7.3} y={10.6} width={3.6} height={3.6} fill={flat.gold} strokeWidth={1.5} />
      <Rect x={13.1} y={10.6} width={3.6} height={3.6} fill={flat.gold} strokeWidth={1.5} />
      <Rect x={9.6} y={16.4} width={4.8} height={5.1} fill={S} stroke="none" />
    </G>
  )
};

export function LocationIcon({ id, size = 24 }: { id: LocationId; size?: number }): JSX.Element {
  const Draw = ICONS[id];
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Draw />
    </Svg>
  );
}
