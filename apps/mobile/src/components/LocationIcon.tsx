/**
 * Distinct flat-vector icon per town location (spec §9.5).
 * Hand-crafted marks on a 24x24 grid — thick outline, flat palette fills.
 * `Record<LocationId, ...>` guarantees at compile time that all 11 exist.
 */
import React from "react";
import Svg, { Circle, Ellipse, G, Line, Path, Polygon, Rect } from "react-native-svg";
import type { LocationId } from "@fastlane/engine";
import { BUILDING_COLOR, flat } from "../theme";

const S = flat.outline;

const ICONS: Record<LocationId, () => JSX.Element> = {
  home: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M3 12 L12 4 L21 12 Z" fill={flat.coral} />
      <Rect x={5.5} y={12} width={13} height={9} fill={BUILDING_COLOR.home} />
      <Rect x={10} y={15.5} width={4} height={5.5} fill={S} stroke="none" />
      <Rect x={7} y={13.6} width={2.6} height={2.6} fill={flat.gold} />
    </G>
  ),

  burgerBarn: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Ellipse cx={12} cy={7} rx={9} ry={3.4} fill={flat.gold} />
      <Rect x={4} y={9} width={16} height={3} fill={flat.green} />
      <Rect x={4} y={12.2} width={16} height={2.6} fill={BUILDING_COLOR.burgerBarn} />
      <Ellipse cx={12} cy={16.5} rx={9} ry={3.4} fill="#F4B62C" />
    </G>
  ),

  college: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M12 5 L22 10 L12 15 L2 10 Z" fill={BUILDING_COLOR.college} />
      <Path d="M6 11.6 V16 C6 17.8 8.7 19 12 19 C15.3 19 18 17.8 18 16 V11.6" fill="none" />
      <Path d="M17 12 v4.4" />
      <Circle cx={17} cy={17} r={1.4} fill={S} />
    </G>
  ),

  gadgetCity: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Rect x={3} y={4.5} width={18} height={12.5} rx={1.6} fill={BUILDING_COLOR.gadgetCity} />
      <Path d="M6.5 8 L10.5 13" stroke={flat.pink} strokeLinecap="round" />
      <Path d="M9 20.5 H15" strokeLinecap="round" />
      <Path d="M12 17 V20.5" />
    </G>
  ),

  flipIt: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M3 13 L11 3 H19 V11 L11 21 Z" fill={BUILDING_COLOR.flipIt} />
      <Circle cx={15} cy={7} r={1.5} fill={flat.skyBottom} />
    </G>
  ),

  dressCode: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path
        d="M9 4 L4.5 7.5 L7 10.5 L9 9.2 V21 H15 V9.2 L17 10.5 L19.5 7.5 L15 4 H14 C14 5.4 13.1 6.4 12 6.4 C10.9 6.4 10 5.4 10 4 Z"
        fill={BUILDING_COLOR.dressCode}
      />
      <Path d="M11 5.6 L12 8 L13 5.6 L12 12 Z" fill={flat.violet} />
    </G>
  ),

  careerHub: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M9 9 V6.5 A3 3 0 0 1 15 6.5 V9" fill="none" />
      <Rect x={3} y={9} width={18} height={11} rx={2} fill={BUILDING_COLOR.careerHub} />
      <Line x1={3} y1={14.2} x2={21} y2={14.2} />
      <Rect x={10.4} y={12.6} width={3.2} height={3.2} fill={flat.gold} />
    </G>
  ),

  bank: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M2 8 L12 3 L22 8 Z" fill={BUILDING_COLOR.bank} />
      <Rect x={2} y={18.5} width={20} height={2.5} fill={BUILDING_COLOR.bank} />
      <Rect x={4.5} y={9.5} width={2.4} height={8.2} fill={flat.outline} />
      <Rect x={9.3} y={9.5} width={2.4} height={8.2} fill={flat.outline} />
      <Rect x={12.3} y={9.5} width={2.4} height={8.2} fill={flat.outline} />
      <Rect x={17.1} y={9.5} width={2.4} height={8.2} fill={flat.outline} />
      <Circle cx={12} cy={6.4} r={1.5} fill={flat.skyBottom} stroke="none" />
    </G>
  ),

  quickMart: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Path d="M2.5 3.5 H5 L6 6" strokeLinecap="round" fill="none" />
      <Polygon points="5,6 21,6 18,15.5 8,15.5" fill={BUILDING_COLOR.quickMart} />
      <Circle cx={9.5} cy={19.5} r={1.7} fill={S} />
      <Circle cx={17} cy={19.5} r={1.7} fill={S} />
    </G>
  ),

  theSpot: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Line x1={12} y1={1.2} x2={12} y2={4.5} />
      <Circle cx={12} cy={13} r={8} fill={flat.pink} />
      <Line x1={4} y1={13} x2={20} y2={13} />
      <Line x1={12} y1={5} x2={12} y2={21} />
      <Path d="M6.3 8 Q12 13 6.3 18" fill="none" />
      <Path d="M17.7 8 Q12 13 17.7 18" fill="none" />
      <Path d="M2 4 L3 6 L1 5.4 Z" fill={flat.gold} stroke="none" />
      <Path d="M22 3.5 L21 5.5 L23 5 Z" fill={flat.gold} stroke="none" />
    </G>
  ),

  rentALord: () => (
    <G stroke={S} strokeWidth={2.2} strokeLinejoin="round">
      <Rect x={4} y={2.5} width={16} height={19} fill={BUILDING_COLOR.rentALord} />
      <Rect x={6.5} y={5} width={3} height={3} fill={flat.gold} />
      <Rect x={14.5} y={5} width={3} height={3} fill={flat.gold} />
      <Rect x={6.5} y={9.6} width={3} height={3} fill={flat.gold} />
      <Rect x={14.5} y={9.6} width={3} height={3} fill={flat.gold} />
      <Rect x={6.5} y={14.2} width={3} height={3} fill={flat.gold} />
      <Rect x={14.5} y={14.2} width={3} height={3} fill={flat.gold} />
      <Rect x={10} y={17.5} width={4} height={4} fill={S} stroke="none" />
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
