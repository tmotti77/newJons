/**
 * Fast Lane design system: dark, punchy, board-game energy.
 * Big readable numbers, high-contrast stat colors (§2.10).
 */

export const colors = {
  bg: "#0F1220",
  bgElevated: "#181C2F",
  card: "#1F2440",
  cardPressed: "#272D4F",
  border: "#2E3560",

  text: "#F4F5FA",
  textDim: "#9AA1C0",
  textFaint: "#5D6488",

  primary: "#FFC53D", // taxi yellow — the "fast lane"
  primaryText: "#231B00",
  accent: "#7C5CFF",
  success: "#3DDC84",
  danger: "#FF5D73",
  info: "#4FC3F7",

  cash: "#3DDC84",
  happiness: "#FF9F43",
  education: "#4FC3F7",
  career: "#C792EA",

  overlay: "rgba(8, 10, 20, 0.82)"
} as const;

export const spacing = { xs: 4, s: 8, m: 12, l: 16, xl: 24, xxl: 32 } as const;

export const radius = { s: 8, m: 12, l: 20, pill: 999 } as const;

export const type = {
  title: { fontSize: 30, fontWeight: "800" as const, color: colors.text },
  h1: { fontSize: 22, fontWeight: "800" as const, color: colors.text },
  h2: { fontSize: 17, fontWeight: "700" as const, color: colors.text },
  body: { fontSize: 15, fontWeight: "500" as const, color: colors.text },
  dim: { fontSize: 13, fontWeight: "500" as const, color: colors.textDim },
  number: { fontSize: 18, fontWeight: "800" as const, color: colors.text },
  tiny: { fontSize: 11, fontWeight: "600" as const, color: colors.textFaint }
} as const;

export const AVATARS: Record<string, { emoji: string; bg: string }> = {
  a1: { emoji: "🦊", bg: "#B85C38" },
  a2: { emoji: "🐼", bg: "#4A4E69" },
  a3: { emoji: "🐸", bg: "#2D6A4F" },
  a4: { emoji: "🦄", bg: "#7C5CFF" },
  a5: { emoji: "🐯", bg: "#B8860B" },
  a6: { emoji: "🐙", bg: "#9D4EDD" },
  a7: { emoji: "🐨", bg: "#5C677D" },
  a8: { emoji: "🐷", bg: "#C9647E" }
};

export const LOCATION_META: Record<string, { emoji: string }> = {
  home: { emoji: "🏠" },
  burgerBarn: { emoji: "🍔" },
  college: { emoji: "🎓" },
  gadgetCity: { emoji: "📱" },
  flipIt: { emoji: "♻️" },
  dressCode: { emoji: "👔" },
  careerHub: { emoji: "💼" },
  bank: { emoji: "🏦" },
  quickMart: { emoji: "🛒" },
  // 🎉 not 🪩: mirror ball is Unicode 14 (2021) and renders as tofu on the
  // older Android emoji fonts we still support.
  theSpot: { emoji: "🎉" },
  rentALord: { emoji: "🏢" }
};

export { flat, BUILDING_COLOR } from "./tokens";
