import { BorderRadius, Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { BlurView } from "expo-blur";
import React from "react";
import { Platform, StyleProp, StyleSheet, View, ViewStyle } from "react-native";

interface GlassViewProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
}

export function GlassView({ children, style, intensity = 50 }: GlassViewProps) {
  const colorScheme = useColorScheme();
  const isDark = colorScheme === "dark";
  const colors = Colors[colorScheme ?? "light"];

  // Android doesn't support BlurView well in all contexts, so we fallback to a semi-transparent background
  if (Platform.OS === "android") {
    return (
      <View
        style={[
          styles.container,
          {
            backgroundColor: isDark
              ? "rgba(20, 20, 25, 0.9)"
              : "rgba(255, 255, 255, 0.9)",
            borderColor: colors.glassBorder,
          },
          style,
        ]}
      >
        {children}
      </View>
    );
  }

  return (
    <BlurView
      intensity={intensity}
      tint={isDark ? "dark" : "light"}
      style={[
        styles.container,
        {
          borderColor: colors.glassBorder,
          backgroundColor: isDark ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.3)", // Subtle tint on top of blur
        },
        style,
      ]}
    >
      {children}
    </BlurView>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: BorderRadius.xl,
    overflow: "hidden",
    borderWidth: 1,
  },
});
