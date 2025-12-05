import { PageLayout } from "@/components/PageLayout";
import { ThemedCard } from "@/components/ThemedCard";
import { BarChart } from "@/components/charts/BarChart";
import { LineChart } from "@/components/charts/LineChart";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getOccupancyTrend, getPeakHours, getPrediction } from "@repo/core";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  StyleSheet,
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
  const [refreshing, setRefreshing] = useState(false);

  const [trends, setTrends] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any>(null); // slope, intercept, points
  const [peakHours, setPeakHours] = useState<any[]>([]);

  // Period Selector (Hours Back)
  const [period, setPeriod] = useState(24); // 24, 168 (7d), 720 (30d)
  const [horizon, setHorizon] = useState("24"); // Prediction Horizon

  // Calculate responsive chart width
  // PageLayout max width is 1400 (or 1600 for wide). Padding is 20 or 40.
  // Sidebar is ~280px on desktop.
  // Let's approximate:
  const isDesktop = windowWidth >= 1024;
  const contentMaxWidth = 1400;
  const horizontalPadding = isDesktop ? 80 : 40; // PageLayout padding
  const cardPadding = 48; // ThemedCard padding (24 * 2)

  // Available width for content
  const availableWidth =
    Math.min(windowWidth, contentMaxWidth) - horizontalPadding;

  // Chart width needs to fit inside the card
  const chartWidth = availableWidth - cardPadding;

  useEffect(() => {
    loadData();
  }, [period]);

  useEffect(() => {
    const timeout = setTimeout(() => {
      loadData();
    }, 500);
    return () => clearTimeout(timeout);
  }, [horizon]);

  const loadData = async () => {
    try {
      if (!refreshing) setLoading(true);
      setError(false);

      const horizonHours = parseInt(horizon, 10) || 24;

      const [trendData, peakData, predData] = await Promise.all([
        getOccupancyTrend(period, period > 24 ? 240 : 60),
        getPeakHours(30),
        getPrediction(period, horizonHours),
      ]);

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
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const styles = StyleSheet.create({
    filterRow: {
      flexDirection: "row",
      marginBottom: 20,
      gap: 10,
    },
    filterButton: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 20,
      backgroundColor: Platform.OS === "ios" ? "rgba(0,0,0,0.05)" : "#2C2C2C",
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.2)",
    },
    filterButtonActive: {
      backgroundColor: theme.tint,
      borderColor: theme.tint,
    },
    filterText: {
      color: theme.text,
      fontSize: 14,
      opacity: 0.7,
    },
    filterTextActive: {
      color: "#FFF",
      fontWeight: "bold",
      opacity: 1,
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
      opacity: 0.6,
      marginTop: 4,
    },
    predictionBadge: {
      backgroundColor: "rgba(255, 215, 0, 0.1)",
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
      fontSize: 14,
      opacity: 0.7,
    },
    settingInput: {
      backgroundColor: Platform.OS === "ios" ? "rgba(0,0,0,0.05)" : "#2C2C2C",
      color: theme.text,
      borderRadius: 6,
      padding: 8,
      width: 60,
      textAlign: "center",
      fontWeight: "bold",
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.2)",
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
      fontSize: 10,
      opacity: 0.6,
    },
  });

  return (
    <PageLayout
      title="Inference & Analytics"
      subtitle="Historical analysis and future predictions"
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      {/* Prediction Config */}
      <View style={styles.settingRow}>
        <ThemedText style={styles.settingLabel}>
          Prediction Horizon (Hours):
        </ThemedText>
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
            <ThemedText
              style={[
                styles.filterText,
                period === item.value && styles.filterTextActive,
              ]}
            >
              {item.label}
            </ThemedText>
          </TouchableOpacity>
        ))}
      </View>

      {loading && !refreshing ? (
        <View style={{ padding: 50, alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.tint} />
          <ThemedText style={{ marginTop: 20, opacity: 0.6 }}>
            Cargando análisis...
          </ThemedText>
        </View>
      ) : error ? (
        <View style={{ padding: 50, alignItems: "center" }}>
          <ThemedText style={{ opacity: 0.6, marginBottom: 20 }}>
            No se pudieron cargar los datos
          </ThemedText>
          <TouchableOpacity
            onPress={loadData}
            style={{
              paddingHorizontal: 20,
              paddingVertical: 10,
              backgroundColor: theme.tint,
              borderRadius: 8,
            }}
          >
            <ThemedText style={{ color: "white", fontWeight: "bold" }}>
              Reintentar
            </ThemedText>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          {/* Occupancy Trend & Prediction */}
          <ThemedCard>
            <View style={styles.cardHeaderRow}>
              <View>
                <ThemedText
                  type="subtitle"
                  style={{ fontSize: 18, fontWeight: "600", marginBottom: 5 }}
                >
                  Occupancy Trend & Prediction
                </ThemedText>
                {predictions && (
                  <View style={styles.predictionBadge}>
                    <ThemedText style={styles.predictionText}>
                      Trend: {predictions.trend_direction}
                    </ThemedText>
                  </View>
                )}
              </View>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: theme.tint }]}
                  />
                  <ThemedText style={styles.legendText}>Historical</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View
                    style={[styles.legendDot, { backgroundColor: "#FFD700" }]}
                  />
                  <ThemedText style={styles.legendText}>Predicted</ThemedText>
                </View>
              </View>
            </View>

            <ThemedText
              style={{ fontSize: 12, opacity: 0.6, marginBottom: 15 }}
            >
              Slope: {predictions?.slope?.toFixed(4) ?? "N/A"}. Showing forecast
              for next {parseInt(horizon) || 24} hours.
            </ThemedText>

            <LineChart
              data={trends}
              prediction={predictions?.predictions}
              width={chartWidth}
              height={250}
              color={theme.tint}
            />
          </ThemedCard>

          {/* Peak Hours Clustering */}
          <ThemedCard title="Peak Hours Analysis" style={{ marginTop: 20 }}>
            <ThemedText
              style={{ fontSize: 12, opacity: 0.6, marginBottom: 15 }}
            >
              Top 5 busiest hours based on {period / 24} days of data. Darker
              red = higher occupancy.
            </ThemedText>
            <BarChart
              data={peakHours}
              width={chartWidth}
              height={250}
              color="#FF6B6B"
            />
          </ThemedCard>

          {/* Stats Summary */}
          <ThemedCard title="Summary Statistics" style={{ marginTop: 20 }}>
            <View style={styles.statRow}>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>
                  {trends.length}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Data Points</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>
                  {period / 24} Days
                </ThemedText>
                <ThemedText style={styles.statLabel}>Analyzed</ThemedText>
              </View>
              <View style={styles.statItem}>
                <ThemedText style={styles.statValue}>
                  {peakHours.length > 0 ? peakHours[0].hour + ":00" : "N/A"}
                </ThemedText>
                <ThemedText style={styles.statLabel}>Peak Hour</ThemedText>
              </View>
            </View>
          </ThemedCard>
        </>
      )}
    </PageLayout>
  );
}
