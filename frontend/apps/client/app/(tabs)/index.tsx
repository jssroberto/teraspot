import { ThemedText } from "@/components/themed-text";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

import { GlassView } from "@/components/ui/glass-view";
import { GradientButton } from "@/components/ui/gradient-button";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { useParkingData } from "@/hooks/use-parking-data";
import { useParkingWebSocket } from "@/hooks/use-parking-web-socket";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const colors = Colors[colorScheme ?? "light"];

  const {
    facilities,
    devicesByFacility,
    selectedFacility,
    selectedDevice,
    setSelectedDevice,
    handleFacilitySelect,
    polygons,
    statuses,
    setStatuses,
    loading,
    loadingConfig,
    errorMsg,
    refresh,
  } = useParkingData();

  const handleWebSocketUpdate = useCallback(
    (data: any) => {
      const { space_id, status } = data;
      setStatuses((p) => ({ ...p, [space_id]: status }));
    },
    [setStatuses]
  );

  const { status: wsStatus } = useParkingWebSocket(handleWebSocketUpdate);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");

  const ASPECT_RATIO = 16 / 9;

  // UI Helpers
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
    return {
      x: rect.x + (sumX / points.length) * rect.width,
      y: rect.y + (sumY / points.length) * rect.height,
    };
  };

  const getStatusColor = (spaceId: string) => {
    const status = statuses[spaceId];
    if (status === "occupied") return "rgba(255, 68, 68, 0.4)"; // Translucent Red
    if (status === "vacant") return "rgba(0, 200, 83, 0.4)"; // Translucent Green
    return "rgba(128, 128, 128, 0.2)";
  };

  const getStrokeColor = (spaceId: string) => {
    const status = statuses[spaceId];
    if (status === "occupied") return "#ff4444";
    if (status === "vacant") return "#00c853";
    return "#888";
  };

  const getWsStatusColor = () => {
    switch (wsStatus) {
      case "connected":
        return "#00c853";
      case "connecting":
        return "#ffb300";
      case "error":
      case "disconnected":
        return "#ff4444";
      default:
        return "#888";
    }
  };

  const getWsStatusText = () => {
    switch (wsStatus) {
      case "connected":
        return "Live";
      case "connecting":
        return "Connecting...";
      case "error":
        return "Error";
      case "disconnected":
        return "Offline";
      default:
        return "Offline";
    }
  };

  if (loading && facilities.length === 0) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color={colors.tint} />
        <ThemedText style={{ marginTop: 20 }}>
          Finding Parking Spots...
        </ThemedText>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />

      {/* Background Gradient */}
      <LinearGradient
        colors={["#0f0c29", "#302b63", "#24243e"]}
        style={StyleSheet.absoluteFill}
      />

      {/* Map Layer (Full Screen) */}
      <View style={StyleSheet.absoluteFill} onLayout={handleLayout}>
        {viewMode === "map" && polygons.length > 0 ? (
          <Svg style={StyleSheet.absoluteFill}>
            {polygons.map((poly, index) => {
              const labelPos = getLabelPosition(poly.polygon);
              return (
                <React.Fragment key={index}>
                  <Polygon
                    points={getPointsString(poly.polygon)}
                    fill={getStatusColor(poly.space_id)}
                    stroke={getStrokeColor(poly.space_id)}
                    strokeWidth="2"
                  />
                  <SvgText
                    x={labelPos.x}
                    y={labelPos.y}
                    fill="white"
                    fontSize="12"
                    fontWeight="bold"
                    textAnchor="middle"
                    alignmentBaseline="middle"
                    stroke="black"
                    strokeWidth="0.5"
                  >
                    {poly.space_id.replace("space-", "")}
                  </SvgText>
                </React.Fragment>
              );
            })}
          </Svg>
        ) : viewMode === "map" && !loadingConfig ? (
          <View style={styles.center}>
            <ThemedText style={{ color: "#666" }}>No ROI Configured</ThemedText>
          </View>
        ) : viewMode === "grid" ? (
          <ScrollView
            contentContainerStyle={{
              paddingTop: insets.top + 140,
              paddingBottom: 250,
              paddingHorizontal: 20,
            }}
          >
            <View style={styles.grid}>
              {polygons.map((poly, index) => {
                const id = poly.space_id.replace("space-", "");
                const status = statuses[poly.space_id];
                const isOccupied = status === "occupied";
                return (
                  <GlassView
                    key={index}
                    style={[
                      styles.gridItem,
                      {
                        borderColor: isOccupied ? colors.error : colors.success,
                      },
                    ]}
                  >
                    <ThemedText style={styles.gridId}>{id}</ThemedText>
                    <ThemedText
                      style={[
                        styles.gridStatus,
                        { color: isOccupied ? colors.error : colors.success },
                      ]}
                    >
                      {isOccupied ? "BUSY" : "FREE"}
                    </ThemedText>
                  </GlassView>
                );
              })}
            </View>
          </ScrollView>
        ) : null}
      </View>

      {/* Header Layer (Floating Glass) */}
      <View style={[styles.headerWrapper, { paddingTop: insets.top }]}>
        <GlassView style={styles.headerGlass}>
          <View style={styles.headerContent}>
            <View>
              <ThemedText type="title" style={styles.appTitle}>
                TeraSpot
              </ThemedText>
              <ThemedText style={styles.subtitle}>
                Smart Parking Finder
              </ThemedText>
            </View>
            <View style={styles.wsStatusContainer}>
              <View
                style={[styles.wsDot, { backgroundColor: getWsStatusColor() }]}
              />
              <ThemedText style={styles.wsText}>{getWsStatusText()}</ThemedText>
            </View>
          </View>
        </GlassView>
      </View>

      {/* Bottom Controls Layer (Floating Glass) */}
      <View
        style={[styles.bottomWrapper, { paddingBottom: insets.bottom + 20 }]}
      >
        {/* View Toggle (Floating above panel) */}
        <TouchableOpacity
          style={styles.viewToggle}
          onPress={() => setViewMode(viewMode === "map" ? "grid" : "map")}
          activeOpacity={0.8}
        >
          <GlassView style={styles.viewToggleGlass}>
            <ThemedText style={styles.viewToggleText}>
              {viewMode === "map" ? "SWITCH TO GRID" : "SWITCH TO MAP"}
            </ThemedText>
          </GlassView>
        </TouchableOpacity>

        <GlassView style={styles.controlsGlass}>
          {/* Facility Selector */}
          <View style={styles.section}>
            <ThemedText style={styles.sectionLabel}>FACILITY</ThemedText>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.scrollContent}
            >
              {facilities.map((fac) => (
                <GradientButton
                  key={fac}
                  label={fac.toUpperCase()}
                  isActive={selectedFacility === fac}
                  onPress={() => handleFacilitySelect(fac)}
                  style={{ marginRight: 10 }}
                />
              ))}
            </ScrollView>
          </View>

          {/* Camera Selector */}
          {selectedFacility &&
            devicesByFacility[selectedFacility]?.length > 0 && (
              <View style={[styles.section, { marginTop: 15 }]}>
                <ThemedText style={styles.sectionLabel}>
                  ZONE / CAMERA
                </ThemedText>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.scrollContent}
                >
                  {devicesByFacility[selectedFacility].map((dev) => (
                    <GradientButton
                      key={dev}
                      label={dev}
                      isActive={selectedDevice === dev}
                      onPress={() => setSelectedDevice(dev)}
                      size="small"
                      style={{ marginRight: 8 }}
                    />
                  ))}
                </ScrollView>
              </View>
            )}
        </GlassView>
      </View>

      {/* Error Banner */}
      {errorMsg && (
        <TouchableOpacity
          onPress={refresh}
          style={[styles.errorBanner, { top: insets.top + 100 }]}
        >
          <GlassView style={styles.errorGlass}>
            <ThemedText style={styles.errorText}>⚠️ {errorMsg}</ThemedText>
          </GlassView>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#000",
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
  },
  headerWrapper: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    paddingBottom: 10,
    zIndex: 10,
  },
  headerGlass: {
    padding: 16,
    borderRadius: 24,
  },
  headerContent: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 24,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
  },
  wsStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.4)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
  },
  wsDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  wsText: {
    color: "#ccc",
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  bottomWrapper: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 16,
    zIndex: 10,
  },
  controlsGlass: {
    padding: 20,
    borderRadius: 32,
  },
  section: {
    // marginBottom: 10,
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: "700",
    color: "rgba(255,255,255,0.5)",
    marginBottom: 8,
    letterSpacing: 1,
    marginLeft: 4,
  },
  scrollContent: {
    paddingRight: 20,
  },
  viewToggle: {
    alignSelf: "center",
    marginBottom: 15,
  },
  viewToggleGlass: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 20,
  },
  viewToggleText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 0.5,
  },
  errorBanner: {
    position: "absolute",
    alignSelf: "center",
    zIndex: 20,
  },
  errorGlass: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: "rgba(255, 68, 68, 0.2)",
    borderColor: "rgba(255, 68, 68, 0.5)",
  },
  errorText: {
    color: "#ff6b6b",
    fontWeight: "bold",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    justifyContent: "center",
  },
  gridItem: {
    width: (SCREEN_WIDTH - 64) / 4,
    aspectRatio: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.05)",
  },
  gridId: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  gridStatus: {
    fontSize: 10,
    fontWeight: "bold",
  },
});
