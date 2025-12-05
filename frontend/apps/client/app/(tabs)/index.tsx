import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { AnimatedCard } from "@/components/animated-card";
import { getParkingStatus, getRoiConfig, RoiSpace } from "@repo/core";
import React, { useEffect, useState, useMemo } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
  RefreshControl,
  Dimensions,
} from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";
import Animated, {
  FadeIn,
  FadeOut,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withRepeat,
  withSequence,
  withTiming,
} from "react-native-reanimated";
import { Colors, Spacing, BorderRadius, Shadows } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import {
  getContainerPadding,
  getGridColumns,
  responsive,
  scaleFontSize,
} from "@/constants/responsive";

const DEVICE_ID = "TeraSpot-Processor"; // Hardcoded for demo

export default function HomeScreen() {
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const [polygons, setPolygons] = useState<RoiSpace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");
  const [headerExpanded, setHeaderExpanded] = useState(true);

  const ASPECT_RATIO = 16 / 9;
  const padding = getContainerPadding();

  // Calculate statistics
  const stats = useMemo(() => {
    const total = polygons.length;
    const occupied = Object.values(statuses).filter((s) => s === "occupied").length;
    const vacant = Object.values(statuses).filter((s) => s === "vacant").length;
    const unknown = total - occupied - vacant;
    return { total, occupied, vacant, unknown };
  }, [polygons, statuses]);

  const fetchStatus = async () => {
    try {
      const spaces = await getParkingStatus();
      const statusMap: Record<string, string> = {};
      spaces.forEach((space) => {
        statusMap[space.space_id] = space.status;
      });
      setStatuses(statusMap);
    } catch (error) {
      console.error("Failed to fetch status", error);
    }
  };

  const loadConfig = async () => {
    try {
      const spaces = await getRoiConfig(DEVICE_ID);
      setPolygons(spaces);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to load config", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadConfig();
  };

  useEffect(() => {
    loadConfig();

    const wsUrl =
      process.env.EXPO_PUBLIC_WEBSOCKET_URL ||
      "wss://vmdq0zxc18.execute-api.us-east-1.amazonaws.com/dev";
    if (!wsUrl) {
      console.warn("WebSocket URL not configured");
      return;
    }

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        console.log("Connected to WebSocket");
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === "UPDATE" && message.data) {
            const { space_id, status } = message.data;
            setStatuses((prev) => ({
              ...prev,
              [space_id]: status,
            }));
          }
        } catch (e) {
          console.error("Failed to parse WebSocket message", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected, reconnecting...");
        reconnectTimeout = setTimeout(connect, 3000);
      };

      ws.onerror = (e) => {
        console.error("WebSocket error", e);
        ws?.close();
      };
    };

    connect();

    return () => {
      ws?.close();
      clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleLayout = (event: any) => {
    const { width, height } = event.nativeEvent.layout;
    setContainerSize({ width, height });
  };

  const getDisplayedRect = () => {
    if (!containerSize.width || !containerSize.height)
      return { x: 0, y: 0, width: 0, height: 0 };

    const containerAspect = containerSize.width / containerSize.height;
    let renderWidth, renderHeight, offsetX, offsetY;

    if (containerAspect > ASPECT_RATIO) {
      renderHeight = containerSize.height;
      renderWidth = renderHeight * ASPECT_RATIO;
      offsetX = (containerSize.width - renderWidth) / 2;
      offsetY = 0;
    } else {
      renderWidth = containerSize.width;
      renderHeight = renderWidth / ASPECT_RATIO;
      offsetX = 0;
      offsetY = (containerSize.height - renderHeight) / 2;
    }

    return { x: offsetX, y: offsetY, width: renderWidth, height: renderHeight };
  };

  const getPointsString = (points: number[][]) => {
    const rect = getDisplayedRect();
    return points
      .map((p) => {
        const px = rect.x + p[0] * rect.width;
        const py = rect.y + p[1] * rect.height;
        return `${px},${py}`;
      })
      .join(" ");
  };

  const getLabelPosition = (points: number[][]) => {
    const rect = getDisplayedRect();
    let sumX = 0,
      sumY = 0;
    points.forEach((p) => {
      sumX += p[0];
      sumY += p[1];
    });
    const centerX = rect.x + (sumX / points.length) * rect.width;
    const centerY = rect.y + (sumY / points.length) * rect.height;
    return { x: centerX, y: centerY };
  };

  const getStatusColor = (spaceId: string) => {
    const status = statuses[spaceId];
    if (status === "occupied") return colors.error;
    if (status === "vacant") return colors.success;
    return colors.textSecondary;
  };

  const gridColumns = getGridColumns(responsive(80, 100, 120));

  return (
    <ThemedView style={styles.container}>
      {/* Glassmorphism Header */}
      <ThemedView glass style={[styles.header, { paddingHorizontal: padding }]}>
        <View style={styles.headerTop}>
          <ThemedText type="title" style={styles.headerTitle}>
            Parking Availability
          </ThemedText>
          <TouchableOpacity
            style={[styles.collapseButton, { backgroundColor: colors.tint }]}
            onPress={() => setHeaderExpanded(!headerExpanded)}
          >
            <ThemedText style={styles.collapseIcon}>
              {headerExpanded ? "▲" : "▼"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {headerExpanded && (
          <>
            {/* Stats Summary */}
            <View style={styles.statsContainer}>
              <AnimatedCard delay={100} style={styles.statCard}>
                <ThemedText type="display" style={{ color: colors.success }}>
                  {stats.vacant}
                </ThemedText>
                <ThemedText type="caption">Vacant</ThemedText>
              </AnimatedCard>

              <AnimatedCard delay={200} style={styles.statCard}>
                <ThemedText type="display" style={{ color: colors.error }}>
                  {stats.occupied}
                </ThemedText>
                <ThemedText type="caption">Occupied</ThemedText>
              </AnimatedCard>

              <AnimatedCard delay={300} style={styles.statCard}>
                <ThemedText type="display" style={{ color: colors.tint }}>
                  {stats.total}
                </ThemedText>
                <ThemedText type="caption">Total</ThemedText>
              </AnimatedCard>
            </View>

            {/* Controls */}
            <View style={styles.controls}>
              <View style={styles.legend}>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: colors.success }]} />
                  <ThemedText style={styles.legendText}>Vacant</ThemedText>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.dot, { backgroundColor: colors.error }]} />
                  <ThemedText style={styles.legendText}>Occupied</ThemedText>
                </View>
              </View>
              <TouchableOpacity
                style={[
                  styles.toggleButton,
                  { backgroundColor: colors.tint },
                  Shadows.md,
                ]}
                onPress={() => setViewMode(viewMode === "map" ? "grid" : "map")}
              >
                <ThemedText style={styles.toggleText}>
                  {viewMode === "map" ? "Grid View" : "Map View"}
                </ThemedText>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ThemedView>

      {/* Content */}
      {viewMode === "map" ? (
        <View
          style={[
            styles.mapContainer,
            {
              marginHorizontal: padding,
              marginTop: Spacing.md,
              borderRadius: BorderRadius.xl,
            },
          ]}
          onLayout={handleLayout}
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={styles.loadingText}>
                Loading parking data...
              </ThemedText>
            </View>
          ) : (
            <Svg style={StyleSheet.absoluteFill}>
              {polygons.map((poly, index) => {
                const labelPos = getLabelPosition(poly.polygon);
                return (
                  <React.Fragment key={index}>
                    <Polygon
                      points={getPointsString(poly.polygon)}
                      fill={getStatusColor(poly.space_id)}
                      stroke={colors.cardBorder}
                      strokeWidth="2"
                      opacity={0.8}
                    />
                    <SvgText
                      x={labelPos.x}
                      y={labelPos.y}
                      fill="white"
                      fontSize={scaleFontSize(12)}
                      fontWeight="bold"
                      textAnchor="middle"
                      alignmentBaseline="middle"
                    >
                      {poly.space_id.replace("space-", "")}
                    </SvgText>
                  </React.Fragment>
                );
              })}
            </Svg>
          )}
        </View>
      ) : (
        <ScrollView
          style={styles.gridContainer}
          contentContainerStyle={[
            styles.gridContent,
            { paddingHorizontal: padding, marginTop: 8 },
          ]}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={colors.tint} />
              <ThemedText style={styles.loadingText}>
                Loading parking data...
              </ThemedText>
            </View>
          ) : (
            <View style={styles.grid}>
              {polygons.map((poly, index) => {
                const id = poly.space_id.replace("space-", "");
                const status = statuses[poly.space_id];
                const isOccupied = status === "occupied";
                const isVacant = status === "vacant";

                return (
                  <AnimatedCard
                    key={index}
                    delay={index * 30}
                    style={{
                      ...styles.gridItem,
                      backgroundColor: isOccupied
                        ? colors.error
                        : isVacant
                          ? colors.success
                          : colors.textSecondary,
                      width: responsive(
                        (Dimensions.get("window").width - padding * 2 - Spacing.md * (gridColumns - 1)) / gridColumns,
                        120,
                        140
                      ),
                      ...Shadows.lg,
                    }}
                  >
                    <ThemedText style={styles.gridText}>{id}</ThemedText>
                    <ThemedText style={styles.statusText}>
                      {isOccupied ? "OCCUPIED" : isVacant ? "VACANT" : "UNKNOWN"}
                    </ThemedText>
                  </AnimatedCard>
                );
              })}
            </View>
          )}
        </ScrollView>
      )}
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    paddingTop: responsive(50, 60, 70),
    paddingBottom: Spacing.lg,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    width: "100%",
    marginBottom: Spacing.md,
  },
  headerTitle: {
    flex: 1,
  },
  collapseButton: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.round,
    justifyContent: "center",
    alignItems: "center",
    ...Shadows.sm,
  },
  collapseIcon: {
    fontSize: scaleFontSize(12),
    color: "#fff",
    fontWeight: "bold",
  },
  statsContainer: {
    flexDirection: "row",
    gap: Spacing.md,
    marginBottom: Spacing.md,
    width: "100%",
    justifyContent: "center",
  },
  statCard: {
    alignItems: "center",
    minWidth: responsive(70, 90, 100),
    padding: Spacing.md,
  },
  controls: {
    flexDirection: responsive("column", "row", "row") as any,
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    gap: Spacing.md,
  },
  legend: {
    flexDirection: "row",
    gap: Spacing.lg,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing.sm,
  },
  legendText: {
    fontSize: scaleFontSize(14),
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: BorderRadius.round,
  },
  toggleButton: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
  },
  toggleText: {
    color: "white",
    fontWeight: "bold",
    fontSize: scaleFontSize(14),
  },
  mapContainer: {
    flex: 1,
    marginBottom: Spacing.lg,
    backgroundColor: "#000",
    overflow: "hidden",
  },
  gridContainer: {
    flex: 1,
  },
  gridContent: {
    paddingBottom: Spacing.xxxl,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: Spacing.md,
    justifyContent: "flex-start",
  },
  gridItem: {
    aspectRatio: 1,
    borderRadius: BorderRadius.lg,
    justifyContent: "center",
    alignItems: "center",
    padding: Spacing.sm,
  },
  gridText: {
    fontSize: scaleFontSize(20),
    fontWeight: "bold",
    color: "#fff",
  },
  statusText: {
    fontSize: scaleFontSize(10),
    fontWeight: "bold",
    color: "#fff",
    marginTop: Spacing.xs,
    letterSpacing: 0.5,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: scaleFontSize(14),
    opacity: 0.7,
  },
});

