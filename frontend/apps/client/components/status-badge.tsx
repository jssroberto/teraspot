/**
 * Animated status badge component with gradient backgrounds
 * Shows parking space status with smooth animations
 */

import { BorderRadius, Colors, Shadows, Spacing } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { ThemedText } from "./themed-text";

export type StatusBadgeProps = {
  status: "vacant" | "occupied" | "unknown";
  label: string;
  size?: "small" | "medium" | "large";
  animated?: boolean;
};

export function StatusBadge({
  status,
  label,
  size = "medium",
  animated = true,
}: StatusBadgeProps) {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];
  const scale = useSharedValue(1);

  // Pulse animation for status changes
  useEffect(() => {
    if (animated && status !== "unknown") {
      scale.value = withSequence(
        withTiming(1.1, { duration: 200, easing: Easing.out(Easing.ease) }),
        withTiming(1, { duration: 200, easing: Easing.in(Easing.ease) })
      );
    }
  }, [status, animated]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const getGradientColors = () => {
    switch (status) {
      case "vacant":
        return [
          colors.successGradientStart,
          colors.successGradientEnd,
        ] as const;
      case "occupied":
        return [colors.errorGradientStart, colors.errorGradientEnd] as const;
      default:
        return [colors.textSecondary, "#888888"] as const;
    }
  };

  const getSizeStyles = () => {
    switch (size) {
      case "small":
        return {
          paddingHorizontal: Spacing.sm,
          paddingVertical: Spacing.xs,
          fontSize: 10,
        };
      case "large":
        return {
          paddingHorizontal: Spacing.xl,
          paddingVertical: Spacing.md,
          fontSize: 16,
        };
      default:
        return {
          paddingHorizontal: Spacing.md,
          paddingVertical: Spacing.sm,
          fontSize: 12,
        };
    }
  };

  const sizeStyles = getSizeStyles();
  const gradientColors = getGradientColors();

  return (
    <Animated.View
      style={[animatedStyle, Shadows.md, { shadowColor: gradientColors[0] }]}
    >
      <LinearGradient
        colors={gradientColors}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.badge,
          {
            paddingHorizontal: sizeStyles.paddingHorizontal,
            paddingVertical: sizeStyles.paddingVertical,
          },
        ]}
      >
        <ThemedText
          style={[
            styles.label,
            {
              fontSize: sizeStyles.fontSize,
              color: "#ffffff",
            },
          ]}
        >
          {label}
        </ThemedText>
      </LinearGradient>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: BorderRadius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    fontWeight: "bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
});
