import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getOccupancyTrend, getPeakHours, getPrediction } from "@repo/core";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";

export default function AnalyticsScreen() {
  const colorScheme = useColorScheme() ?? "dark";
  const theme = Colors[colorScheme];
  const { width: windowWidth } = useWindowDimensions();
  const [loading, setLoading] = useState(true);

  const [trends, setTrends] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null); // slope, intercept, points
  const [peakHours, setPeakHours] = useState<any[]>([]);

  // Period Selector (Hours Back)
  const [period, setPeriod] = useState(24); // 24, 168 (7d), 720 (30d)
  const [horizon, setHorizon] = useState("24"); // Prediction Horizon

  // Calculate responsive chart width
  // On web with sidebar: windowWidth - sidebar(280px) - padding(60px)
  // On mobile: windowWidth - padding(60px)
  const chartWidth = windowWidth > 1024 ? windowWidth - 340 : windowWidth - 60;

  useEffect(() => {
    loadData();
  }, [period]); // Reload when period changes

  // Reload when horizon changes (debounced ideally, but onBlur/button is better, here simple effect for demo)
  // Actually, let's just make it reload on button or focus change.
  // For simplicity, I'll add a "Refresh" button or just hook it to effect with debouncing?
  // I'll hook it to effect but with check.
  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeout);
  }, [horizon]);

  const loadData = async () => {
    try {
      setLoading(true);

      const horizonHours = parseInt(horizon, 10) || 24;

      const [trendData, peakData, predData] = await Promise.all([
        getOccupancyTrend(period, period > 24 ? 240 : 60), // Coarser interval for longer periods
        getPeakHours(30), // Always analyze last 30 days for peak hours
        getPrediction(period, horizonHours), // Predict next 24h based on period
      ]);

      console.log("Trend data:", trendData);
      console.log("Peak data:", peakData);
      console.log("Prediction data:", predData);

      // Handle both response formats:
      // 1. Direct: {kpi: "name", data: {...}}
      // 2. Nested: {level_3_analytics: {occupancy_trend: {...}}}
      const trendResult =
        trendData?.level_3_analytics?.occupancy_trend ||
        trendData?.data ||
        trendData;
      const peakResult =
        peakData?.level_3_analytics?.peak_hours || peakData?.data || peakData;
      const predResult = predData?.data || predData;

      setTrends(trendResult.trend_data || []);
      setPeakHours(peakResult.peak_hours || []);
      setPredictions(predResult);
    } catch (error) {
      console.error("Failed to load analytics:", error);
      Alert.alert(
        "Error",
        `Failed to load analytics data: ${(error as Error).message}`
      );
    } finally {
      setLoading(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      padding: 20,
      paddingBottom: 40,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 24,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 14,
      color: theme.icon,
    },
    card: {
      backgroundColor: "#1E1E1E",
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#333",
    },
    cardTitle: {
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 15,
    },
    cardSubtitle: {
      fontSize: 12,
      color: "#AAA",
      marginBottom: 10,
    },
    filterRow: {
      flexDirection: "row",
      marginBottom: 20,
      backgroundColor: "#333",
      borderRadius: 8,
      padding: 4,
    },
    filterButton: {
      flex: 1,
      paddingVertical: 8,
      alignItems: "center",
      borderRadius: 6,
    },
    filterButtonActive: {
      backgroundColor: theme.tint,
    },
    filterText: {
      color: "#CCC",
      fontWeight: "600",
    },
    filterTextActive: {
      color: "#FFF",
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 15,
    },
    statItem: {
      alignItems: "center",
    },
    statValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: "#FFF",
    },
    statLabel: {
      fontSize: 12,
      color: "#AAA",
    },
    predictionBadge: {
      backgroundColor:
        predictions?.trend_direction === "INCREASING"
          ? "#FF4444"
          : predictions?.trend_direction === "DECREASING"
            ? "#44AA44"
            : "#888",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: "flex-start",
      marginBottom: 10,
    },
    predictionText: {
      color: "#FFF",
      fontSize: 12,
      fontWeight: "bold",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15,
      backgroundColor: "#1E1E1E",
      padding: 12,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: "#333",
    },
    settingLabel: {
      color: "#CCC",
      fontSize: 14,
    },
    settingInput: {
      backgroundColor: "#2C2C2C",
      color: "#FFF",
      borderRadius: 6,
      padding: 8,
      width: 60,
      textAlign: "center",
      fontWeight: "bold",
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },
    legend: {
      flexDirection: "row",
      gap: 12,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 10,
      height: 10,
      borderRadius: 5,
    },
    legendText: {
      color: "#CCC",
      fontSize: 12,
    },
  });

  return (
    <>
      <Stack.Screen options={{ title: "Analytics", headerShown: true }} />
      <ScrollView
        style={styles.container}
        contentContainerStyle={styles.scrollView}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Inference & Analytics</Text>
          <Text style={styles.subtitle}>
            Historical analysis and future predictions
          </Text>
        </View>

        {/* Prediction Config */}
        <View style={styles.settingRow}>
          <Text style={styles.settingLabel}>Prediction Horizon (Hours):</Text>
          <TextInput
            style={styles.settingInput}
            value={horizon}
            onChangeText={setHorizon}
            keyboardType="numeric"
            maxLength={3}
          />
        </View>

        {/* Period Selector */}
        <View style={styles.filterRow}>
          {[
            { label: "24 Hours", value: 24 },
            { label: "7 Days", value: 168 },
            { label: "30 Days", value: 720 },
          ].map((item) => (
            <TouchableOpacity
              key={item.value}
              style={[
                styles.filterButton,
                period === item.value && styles.filterButtonActive,
              ]}
              onPress={() => setPeriod(item.value)}
            >
              <Text
                style={[
                  styles.filterText,
                  period === item.value && styles.filterTextActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {loading ? (
          <ActivityIndicator
            size="large"
            color={theme.tint}
            style={{ marginTop: 20 }}
          />
        ) : (
          <>
            {/* Occupancy Trend & Prediction */}
            <View style={styles.card}>
              <View style={styles.cardHeaderRow}>
                <View>
                  <Text style={styles.cardTitle}>
                    Occupancy Trend & Prediction
                  </Text>
                  {predictions && (
                    <View style={styles.predictionBadge}>
                      <Text style={styles.predictionText}>
                        Trend: {predictions.trend_direction}
                      </Text>
                    </View>
                  )}
                </View>
                <View style={styles.legend}>
                  <View style={styles.legendItem}>
                    <View
                      style={[
                        styles.legendDot,
                        { backgroundColor: theme.tint },
                      ]}
                    />
                    <Text style={styles.legendText}>Historical</Text>
                  </View>
                  <View style={styles.legendItem}>
                    <View
                      style={[styles.legendDot, { backgroundColor: "#FFD700" }]}
                    />
                    <Text style={styles.legendText}>Predicted</Text>
                  </View>
                </View>
              </View>

              <Text style={styles.cardSubtitle}>
                Slope: {predictions?.slope?.toFixed(4) ?? "N/A"}. Showing
                forecast for next {parseInt(horizon) || 24} hours.
              </Text>

              <LineChart
                data={trends}
                prediction={predictions?.predictions}
                width={chartWidth}
                height={250}
                color={theme.tint}
              />
            </View>

            {/* Peak Hours Clustering */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Peak Hours Analysis</Text>
              <Text style={styles.cardSubtitle}>
                Top 5 busiest hours based on {period / 24} days of data. Darker
                red = higher occupancy.
              </Text>
              <BarChart
                data={peakHours}
                width={chartWidth}
                height={250}
                color="#FF6B6B"
              />
            </View>

            {/* Stats Summary */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Summary Statistics</Text>
              <View style={styles.statRow}>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{trends.length}</Text>
                  <Text style={styles.statLabel}>Data Points</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>{period / 24} Days</Text>
                  <Text style={styles.statLabel}>Analyzed</Text>
                </View>
                <View style={styles.statItem}>
                  <Text style={styles.statValue}>
                    {peakHours.length > 0 ? peakHours[0].hour + ":00" : "N/A"}
                  </Text>
                  <Text style={styles.statLabel}>Peak Hour</Text>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>
    </>
  );
}
