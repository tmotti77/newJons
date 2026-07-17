import { useTranslation } from "react-i18next";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { applyRTL } from "../src/i18n";

// Phase 0 blank home: proves expo-router boots and i18n/RTL is wired
// (DEV_PLAN §4.1, §5.1). Real screens (/create, /join, /lobby, ...) land
// in Phase 3.
export default function Home() {
  const { t, i18n } = useTranslation();

  const toggleLanguage = () => {
    const next = i18n.language === "he" ? "en" : "he";
    void i18n.changeLanguage(next);
    applyRTL(next);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{t("home.title")}</Text>
      <Text style={styles.tagline}>{t("home.tagline")}</Text>

      <Pressable style={styles.button} disabled>
        <Text style={styles.buttonText}>{t("home.createGame")}</Text>
      </Pressable>
      <Pressable style={styles.button} disabled>
        <Text style={styles.buttonText}>{t("home.joinGame")}</Text>
      </Pressable>

      <Pressable style={styles.langButton} onPress={toggleLanguage}>
        <Text style={styles.langButtonText}>{t("common.language")}: {i18n.language}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, alignItems: "center", justifyContent: "center", gap: 16, padding: 24 },
  title: { fontSize: 32, fontWeight: "700" },
  tagline: { fontSize: 16, opacity: 0.7, textAlign: "center" },
  button: { paddingVertical: 12, paddingHorizontal: 24, borderRadius: 8, backgroundColor: "#eee" },
  buttonText: { fontSize: 16, fontWeight: "600" },
  langButton: { marginTop: 24, padding: 8 },
  langButtonText: { fontSize: 14, opacity: 0.6 }
});
