// Hermes ships without Intl.PluralRules; i18next needs it for correct Hebrew
// plural categories (one/two/many/other). Must load before i18next.init.
import "intl-pluralrules";

import * as Localization from "expo-localization";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { I18nManager } from "react-native";

import en from "./en.json";
import he from "./he.json";

export const RTL_LANGUAGES = ["he"];

export function isRTL(language: string): boolean {
  return RTL_LANGUAGES.includes(language);
}

/**
 * Applies RTL layout direction for the given language. Expo/React Native
 * requires an app reload after I18nManager.forceRTL changes to take full
 * effect on native layout — the mobile screen calling this should prompt
 * a reload (expo-updates reloadAsync) when the value actually changes.
 */
export function applyRTL(language: string): boolean {
  const shouldBeRTL = isRTL(language);
  const changed = I18nManager.isRTL !== shouldBeRTL;
  if (changed) {
    I18nManager.allowRTL(shouldBeRTL);
    I18nManager.forceRTL(shouldBeRTL);
  }
  return changed;
}

const deviceLanguage = Localization.getLocales()[0]?.languageCode ?? "en";
const initialLanguage = ["en", "he"].includes(deviceLanguage) ? deviceLanguage : "en";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    he: { translation: he }
  },
  lng: initialLanguage,
  fallbackLng: "en",
  interpolation: { escapeValue: false }
});

applyRTL(initialLanguage);

export default i18n;
