import { type JSX } from "react";
import { Platform, StyleSheet, Text } from "react-native";

export function Code({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}): JSX.Element {
  return <Text style={styles.code}>{children}</Text>;
}

const styles = StyleSheet.create({
  code: {
    fontFamily: Platform.select({
      ios: "Menlo",
      android: "monospace",
      default: "monospace",
    }),
    backgroundColor: "#f4f4f4",
    padding: 4,
    borderRadius: 4,
    fontSize: 14,
  },
});
