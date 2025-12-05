import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import React from "react";
import { StyleSheet, ViewStyle } from "react-native";

interface ThemedCardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  variant?: "default" | "outlined";
  title?: string;
}

export function ThemedCard({
  children,
  style,
  variant = "default",
  title,
}: ThemedCardProps) {
  return (
    <ThemedView
      style={[styles.card, variant === "outlined" && styles.outlined, style]}
    >
      {title && (
        <ThemedText type="subtitle" style={styles.title}>
          {title}
        </ThemedText>
      )}
      {children}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 24,
    borderRadius: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    // Background color is handled by ThemedView
  },
  outlined: {
    borderWidth: 1,
    borderColor: "rgba(150, 150, 150, 0.2)",
    shadowOpacity: 0,
    elevation: 0,
  },
  title: {
    marginBottom: 16,
    fontSize: 18,
    fontWeight: "600",
  },
});
