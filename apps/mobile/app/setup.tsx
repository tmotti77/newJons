import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";
import { useTranslation } from "react-i18next";

import { AVATARS, colors, radius, spacing, type } from "../src/theme";
import { Avatar, Button, Screen } from "../src/components/ui";
import { saveProfile } from "../src/stores/gameStore";

export default function Setup() {
  const { t } = useTranslation();
  const { next } = useLocalSearchParams<{ next?: string }>();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState("a1");

  const done = async () => {
    await saveProfile({ displayName: name.trim(), avatar });
    router.replace((next ?? "/") as never);
  };

  return (
    <Screen style={{ justifyContent: "center", gap: spacing.xl }}>
      <Text style={[type.h1, { textAlign: "center" }]}>{t("setup.title")}</Text>

      <TextInput
        value={name}
        onChangeText={setName}
        placeholder={t("setup.namePlaceholder")}
        placeholderTextColor={colors.textFaint}
        maxLength={20}
        style={{
          backgroundColor: colors.card,
          borderRadius: radius.m,
          borderWidth: 1,
          borderColor: colors.border,
          color: colors.text,
          padding: spacing.l,
          fontSize: 18,
          textAlign: "center"
        }}
      />

      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: spacing.m, justifyContent: "center" }}>
        {Object.keys(AVATARS).map((id) => (
          <Pressable key={id} onPress={() => setAvatar(id)} style={{ borderRadius: 40, borderWidth: 3, borderColor: avatar === id ? colors.primary : "transparent", padding: 2 }}>
            <Avatar id={id} size={56} />
          </Pressable>
        ))}
      </View>

      <Button label={t("setup.done")} disabled={name.trim().length === 0} onPress={() => void done()} />
    </Screen>
  );
}
