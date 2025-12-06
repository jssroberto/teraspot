import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useParkingData } from "@/hooks/use-parking-data";
import { useParkingWebSocket } from "@/hooks/use-parking-web-socket";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  ScrollView,
  StatusBar,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

export default function HomeScreen() {
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
  const HEADER_HEIGHT = Platform.OS === "ios" ? 50 : 20;

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
    if (status === "occupied") return "rgba(255, 68, 68, 0.6)"; // Soft Red
    if (status === "vacant") return "rgba(0, 200, 83, 0.5)"; // Soft Green
    return "rgba(128, 128, 128, 0.3)";
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
        return "Connection Error";
      case "disconnected":
        return "Disconnected";
      default:
        return "Offline";
    }
  };

  if (loading && facilities.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <ThemedText style={{ marginTop: 20 }}>
          Finding Parking Spots...
        </ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.headerContainer, { paddingTop: HEADER_HEIGHT }]}>
        <View style={styles.headerRow}>
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
      </View>

      {/* Selectors */}
      <View style={styles.selectorContainer}>
        {/* Facility Selector */}
        <View style={styles.rowLabel}>
          <ThemedText type="defaultSemiBold">FACILITY</ThemedText>
        </View>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.scrollRow}
        >
          {facilities.map((fac) => (
            <TouchableOpacity
              key={fac}
              style={[
                styles.pill,
                selectedFacility === fac && styles.pillActive,
              ]}
              onPress={() => handleFacilitySelect(fac)}
            >
              <ThemedText
                style={[
                  styles.pillText,
                  selectedFacility === fac && styles.pillTextActive,
                ]}
              >
                {fac.toUpperCase()}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Camera/Zone Selector (Only if facility selected) */}
        {selectedFacility &&
          devicesByFacility[selectedFacility]?.length > 0 && (
            <>
              <View style={[styles.rowLabel, { marginTop: 15 }]}>
                <ThemedText type="defaultSemiBold">CAMERA / ZONE</ThemedText>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.scrollRow}
              >
                {devicesByFacility[selectedFacility].map((dev) => (
                  <TouchableOpacity
                    key={dev}
                    style={[
                      styles.pill,
                      styles.pillSmall,
                      selectedDevice === dev && styles.pillActive,
                    ]}
                    onPress={() => setSelectedDevice(dev)}
                  >
                    <ThemedText
                      style={[
                        styles.pillText,
                        styles.pillTextSmall,
                        selectedDevice === dev && styles.pillTextActive,
                      ]}
                    >
                      {dev}
                    </ThemedText>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </>
          )}
      </View>

      {/* Error Banner */}
      {errorMsg && (
        <TouchableOpacity onPress={refresh} style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>
            ⚠️ {errorMsg} (Tap to Retry)
          </ThemedText>
        </TouchableOpacity>
      )}

      {/* Main Content */}
      <View style={styles.contentArea}>
        {/* Toolbar */}
        <View style={styles.toolbar}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "#00c853" }]} />
              <ThemedText style={styles.legendText}>Vacant</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "#ff4444" }]} />
              <ThemedText style={styles.legendText}>Occupied</ThemedText>
            </View>
          </View>

          <TouchableOpacity
            style={styles.viewToggle}
            onPress={() => setViewMode(viewMode === "map" ? "grid" : "map")}
          >
            <ThemedText style={styles.viewToggleText}>
              {viewMode === "map" ? "GRID VIEW" : "MAP VIEW"}
            </ThemedText>
          </TouchableOpacity>
        </View>

        {/* Map/Grid */}
        {loadingConfig ? (
          <View style={[styles.vizContainer, styles.center]}>
            <ActivityIndicator color="#fff" />
          </View>
        ) : viewMode === "map" ? (
          <View style={styles.vizContainer} onLayout={handleLayout}>
            {polygons.length > 0 ? (
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
                        fontSize="10"
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
            ) : (
              <View style={styles.center}>
                <ThemedText style={{ color: "#666" }}>
                  No ROI Configured
                </ThemedText>
              </View>
            )}
          </View>
        ) : (
          <ScrollView style={styles.gridContainer}>
            <View style={styles.grid}>
              {polygons.map((poly, index) => {
                const id = poly.space_id.replace("space-", "");
                const status = statuses[poly.space_id];
                const isOccupied = status === "occupied";
                return (
                  <View
                    key={index}
                    style={[
                      styles.gridItem,
                      { backgroundColor: isOccupied ? "#ff4444" : "#00c853" },
                    ]}
                  >
                    <ThemedText style={styles.gridId}>{id}</ThemedText>
                    <ThemedText style={styles.gridStatus}>
                      {isOccupied ? "BUSY" : "FREE"}
                    </ThemedText>
                  </View>
                );
              })}
            </View>
          </ScrollView>
        )}
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#121212", // Dark background
  },
  center: {
    justifyContent: "center",
    alignItems: "center",
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: "#1e1e1e",
    borderBottomWidth: 1,
    borderBottomColor: "#333",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  appTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.5,
  },
  subtitle: {
    color: "#aaa",
    fontSize: 14,
    marginTop: 2,
  },
  wsStatusContainer: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#333",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 12,
  },
  wsDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  wsText: {
    color: "#ccc",
    fontSize: 12,
    fontWeight: "600",
  },
  selectorContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: "#181818",
  },
  rowLabel: {
    marginBottom: 8,
  },
  scrollRow: {
    flexDirection: "row",
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#333",
    borderRadius: 12,
    marginRight: 12,
  },
  pillActive: {
    backgroundColor: "#0a7ea4", // Brand Blue
    shadowColor: "#0a7ea4",
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  pillText: {
    color: "#ccc",
    fontWeight: "600",
    fontSize: 14,
  },
  pillTextActive: {
    color: "#fff",
    fontWeight: "bold",
  },
  pillSmall: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  pillTextSmall: {
    fontSize: 12,
  },
  errorBanner: {
    backgroundColor: "#3e1b1b",
    padding: 10,
    margin: 10,
    borderRadius: 8,
    alignItems: "center",
  },
  errorText: {
    color: "#ff6b6b",
    fontWeight: "bold",
  },
  contentArea: {
    flex: 1,
    backgroundColor: "#121212",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: "hidden",
    marginTop: 5,
  },
  toolbar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  legend: {
    flexDirection: "row",
    gap: 15,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: "#aaa",
    fontSize: 12,
  },
  viewToggle: {
    backgroundColor: "#2a2a2a",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#444",
  },
  viewToggleText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "bold",
  },
  vizContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 20,
    backgroundColor: "#1f1f1f",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#333",
    overflow: "hidden",
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    paddingBottom: 40,
    justifyContent: "center",
  },
  gridItem: {
    width: "30%",
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 2,
  },
  gridId: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#fff",
    marginBottom: 4,
  },
  gridStatus: {
    fontSize: 10,
    fontWeight: "bold",
    color: "rgba(255,255,255,0.8)",
  },
});
