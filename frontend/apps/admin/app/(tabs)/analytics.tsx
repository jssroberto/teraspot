import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getOccupancyTrend, getPeakHours, getPrediction } from "@repo/core";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
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
  const [error, setError] = useState(false);

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
      setError(false);

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
      setError(true);
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
    },
    header: {
      marginBottom: 20,
    },
    title: {
      fontSize: 28,
      fontWeight: "bold",
      color: theme.text,
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 14,
      color: "#888",
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
      marginBottom: 5,
    },
    cardSubtitle: {
      fontSize: 12,
      color: "#AAA",
      marginBottom: 15,
    },
    filterRow: {
      flexDirection: "row",
      marginBottom: 20,
      gap: 10,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: "#2C2C2C",
      borderWidth: 1,
      borderColor: "#444",
    },
    filterButtonActive: {
      backgroundColor: theme.tint,
      borderColor: theme.tint,
    },
    filterText: {
      color: "#CCC",
      fontSize: 14,
    },
    filterTextActive: {
      color: "#FFF",
      fontWeight: "bold",
    },
    statRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginTop: 10,
    },
    statItem: {
      alignItems: "center",
      flex: 1,
    },
    statValue: {
      fontSize: 20,
      fontWeight: "bold",
      color: theme.text,
    },
    statLabel: {
      fontSize: 12,
      color: "#888",
      marginTop: 4,
    },
    predictionBadge: {
      backgroundColor: "#2C2C2C",
      paddingHorizontal: 8,
      paddingVertical: 4,
      borderRadius: 4,
      alignSelf: "flex-start",
      marginTop: 4,
    },
    predictionText: {
      color: "#FFD700",
      fontSize: 12,
      fontWeight: "bold",
    },
    settingRow: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      marginBottom: 15,
      gap: 10,
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
      borderWidth: 1,
      borderColor: "#444",
    },
    cardHeaderRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "flex-start",
      marginBottom: 10,
    },
    legend: {
      flexDirection: "column",
      gap: 4,
    },
    legendItem: {
      flexDirection: "row",
      alignItems: "center",
      gap: 6,
    },
    legendDot: {
      width: 8,
      height: 8,
      borderRadius: 4,
    },
    legendText: {
      color: "#CCC",
      fontSize: 10,
    },
    loadingContainer: {
      padding: 50,
      alignItems: "center",
    },
  });

  return (
    <>
      <Stack.Screen
        options={{ title: "Analytics Dashboard", headerShown: true }}
      />
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
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.tint} />
            <Text style={{ marginTop: 20, opacity: 0.6, color: theme.text }}>
              Cargando análisis...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.loadingContainer}>
            <Text style={{ opacity: 0.6, marginBottom: 20, color: theme.text }}>
              No se pudieron cargar los datos
            </Text>
            <TouchableOpacity
              onPress={loadData}
              style={{
                paddingHorizontal: 20,
                paddingVertical: 10,
                backgroundColor: theme.tint,
                borderRadius: 8,
              }}
            >
              <Text style={{ color: "white", fontWeight: "bold" }}>
                Reintentar
              </Text>
            </TouchableOpacity>
          </View>
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
