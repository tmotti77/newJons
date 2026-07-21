import type { LocationId } from "@fastlane/engine";

/** Flat-vector palette additions (spec §4.1). Warm dusk, bold. */
export const flat = {
  coral: "#FF5A4D",
  teal: "#1EB6A0",
  gold: "#E9A51F",
  violet: "#7D63E8",
  pink: "#FF7AB0",
  green: "#4FB96A",
  outline: "#241C2E",
  skyTop: "#FF8F6B",
  skyBottom: "#FFD98A",
  road: "#6E6A7A",
  grass: "#7ECB8C"
} as const;

/** Per-building body colour — one identity per place. */
export const BUILDING_COLOR: Record<LocationId, string> = {
  home: "#8FB8FF",
  burgerBarn: "#FF5A4D",
  college: "#1EB6A0",
  gadgetCity: "#7D63E8",
  flipIt: "#8B6F52",
  dressCode: "#C9647E",
  careerHub: "#4F86C6",
  bank: "#E9A51F",
  quickMart: "#4FB96A",
  theSpot: "#2A2140",
  rentALord: "#5C677D"
};
