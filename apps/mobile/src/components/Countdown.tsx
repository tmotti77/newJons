/**
 * Server-timestamp countdown (§3.4): renders remaining time from ends_at;
 * local clocks are never the source of truth. onExpire fires once.
 */
import React, { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";

import { colors, type } from "../theme";
import { ProgressBar } from "./ui";

export function Countdown(props: {
  endsAt: string;
  totalSeconds: number;
  onExpire?: () => void;
}) {
  const [now, setNow] = useState(Date.now());
  const fired = useRef(false);

  useEffect(() => {
    fired.current = false;
    const t = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(t);
  }, [props.endsAt]);

  const msLeft = Math.max(0, Date.parse(props.endsAt) - now);
  const secondsLeft = Math.ceil(msLeft / 1000);

  useEffect(() => {
    if (msLeft <= 0 && !fired.current) {
      fired.current = true;
      props.onExpire?.();
    }
  }, [msLeft, props]);

  const pct = props.totalSeconds > 0 ? secondsLeft / props.totalSeconds : 0;
  const urgent = secondsLeft <= 10;

  return (
    <View style={{ gap: 4 }}>
      <Text
        style={[
          type.number,
          { textAlign: "center", color: urgent ? colors.danger : colors.text, fontVariant: ["tabular-nums"] }
        ]}
      >
        {Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, "0")}
      </Text>
      <ProgressBar pct={pct} color={urgent ? colors.danger : colors.primary} height={5} />
    </View>
  );
}
