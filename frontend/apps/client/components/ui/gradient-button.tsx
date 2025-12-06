import { ThemedText } from "@/components/themed-text";
import { BorderRadius, Colors, Shadows } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import {
  StyleSheet,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";

interface GradientButtonProps {
  label: string;
  onPress: () => void;
  isActive?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  size?: "small" | "medium";
}

export function GradientButton({
  label,
  onPress,
  isActive = false,
  style,
  textStyle,
  size = "medium",
}: GradientButtonProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const Container = isActive ? LinearGradient : TouchableOpacity;

  // Define gradient colors based on theme
  const gradientColors = [colors.tint, "hsl(217, 91%, 45%)"] as const;

  const content = (
    <ThemedText
      style={[
        styles.text,
        size === "small" && styles.textSmall,
        isActive && styles.textActive,
        textStyle,
      ]}
    >
      {label}
    </ThemedText>
  );

  if (isActive) {
    return (
      <TouchableOpacity onPress={onPress} activeOpacity={0.8}>
        <LinearGradient
          colors={gradientColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.container,
            size === "small" && styles.containerSmall,
            Shadows.md,
            { shadowColor: colors.tint }, // Colored shadow
            style,
          ]}
        >
          {content}
        </LinearGradient>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.container,
        size === "small" && styles.containerSmall,
        { backgroundColor: colors.cardBackground },
        style,
      ]}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: BorderRadius.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  containerSmall: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: BorderRadius.md,
  },
  text: {
    fontWeight: "600",
    fontSize: 14,
  },
  textSmall: {
    fontSize: 12,
  },
  textActive: {
    color: "#ffffff",
    fontWeight: "700",
  },
});
