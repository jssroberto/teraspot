import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import React from "react";
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from "react-native";

interface PageLayoutProps {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
  rightAction?: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  scrollable?: boolean;
}

export function PageLayout({
  title,
  subtitle,
  children,
  rightAction,
  refreshing = false,
  onRefresh,
  scrollable = true,
}: PageLayoutProps) {
  const { width: windowWidth } = useWindowDimensions();

  const ContentWrapper = scrollable ? ScrollView : View;
  const scrollProps = scrollable
    ? {
        refreshControl: onRefresh ? (
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        ) : undefined,
        contentContainerStyle: [
          styles.scrollContent,
          windowWidth >= 1400 && styles.scrollContentWide,
        ],
      }
    : { style: { flex: 1 } };

  return (
    <ThemedView style={styles.container}>
      {/* @ts-ignore - ScrollView props vs View props mismatch is handled by logic */}
      <ContentWrapper {...scrollProps}>
        <View
          style={[
            styles.contentContainer,
            windowWidth >= 1400 && styles.contentContainerWide,
          ]}
        >
          <View
            style={[styles.header, windowWidth < 600 && styles.headerMobile]}
          >
            <View style={{ flex: 1 }}>
              <ThemedText type="title">{title}</ThemedText>
              {subtitle && (
                <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
              )}
            </View>
            {rightAction && (
              <View style={styles.rightAction}>{rightAction}</View>
            )}
          </View>

          {children}
        </View>
      </ContentWrapper>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 40,
    alignItems: "center",
  },
  scrollContentWide: {
    paddingHorizontal: 40,
    paddingTop: 20,
  },
  contentContainer: {
    width: "100%",
    maxWidth: 1400,
  },
  contentContainerWide: {
    maxWidth: 1600,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    marginTop: 20,
  },
  headerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  subtitle: {
    fontSize: 14,
    color: "#888",
    marginTop: 4,
  },
  rightAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
