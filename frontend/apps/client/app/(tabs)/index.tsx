import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { getParkingStatus, getRoiConfig, RoiSpace } from "@repo/core";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

const DEVICE_ID = "TeraSpot-edge-device"; // Hardcoded for demo

export default function HomeScreen() {
  const [polygons, setPolygons] = useState<RoiSpace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");

  const ASPECT_RATIO = 16 / 9;

  useEffect(() => {
    loadConfig();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, []); // loadConfig is defined inside component, so we can't easily add it without useCallback or moving it out. Leaving empty array is intentional for mount-only effect, suppressing warning would be better but for now this is fine.

  const loadConfig = async () => {
    try {
      const spaces = await getRoiConfig(DEVICE_ID);
      setPolygons(spaces);
      await fetchStatus();
    } catch (error) {
      console.error("Failed to load config", error);
    } finally {
      setLoading(false);
    }
  };

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
    if (status === "occupied") return "rgba(255, 0, 0, 0.6)"; // Red
    if (status === "vacant") return "rgba(0, 255, 0, 0.6)"; // Green
    return "rgba(128, 128, 128, 0.3)"; // Grey (Unknown)
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Parking Availability</ThemedText>
        <View style={styles.controls}>
          <View style={styles.legend}>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "green" }]} />
              <ThemedText>Vacant</ThemedText>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.dot, { backgroundColor: "red" }]} />
              <ThemedText>Occupied</ThemedText>
            </View>
          </View>
          <TouchableOpacity
            style={styles.toggleButton}
            onPress={() => setViewMode(viewMode === "map" ? "grid" : "map")}
          >
            <ThemedText style={styles.toggleText}>
              {viewMode === "map" ? "Switch to Grid" : "Switch to Map"}
            </ThemedText>
          </TouchableOpacity>
        </View>
      </View>

      {viewMode === "map" ? (
        <View style={styles.mapContainer} onLayout={handleLayout}>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
            <Svg style={StyleSheet.absoluteFill}>
              {polygons.map((poly, index) => {
                const labelPos = getLabelPosition(poly.polygon);
                return (
                  <React.Fragment key={index}>
                    <Polygon
                      points={getPointsString(poly.polygon)}
                      fill={getStatusColor(poly.space_id)}
                      stroke="white"
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
        <ScrollView style={styles.gridContainer}>
          {loading ? (
            <ActivityIndicator size="large" color="#fff" />
          ) : (
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
                      { backgroundColor: isOccupied ? "#ff4444" : "#44ff44" },
                    ]}
                  >
                    <ThemedText style={styles.gridText}>{id}</ThemedText>
                    <ThemedText style={styles.statusText}>
                      {isOccupied ? "OCCUPIED" : "VACANT"}
                    </ThemedText>
                  </View>
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
    padding: 20,
    paddingTop: 50,
    alignItems: "center",
  },
  controls: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    alignItems: "center",
    marginTop: 10,
  },
  legend: {
    flexDirection: "row",
    gap: 20,
  },
  legendItem: {
    flexDirection: "row",
    alignItems: "center",
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 8,
  },
  toggleButton: {
    backgroundColor: "#555",
    padding: 8,
    borderRadius: 5,
  },
  toggleText: {
    color: "white",
    fontWeight: "bold",
  },
  mapContainer: {
    flex: 1,
    margin: 20,
    backgroundColor: "#000",
    borderRadius: 10,
    overflow: "hidden",
  },
  gridContainer: {
    flex: 1,
    padding: 10,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 10,
    paddingBottom: 40,
  },
  gridItem: {
    width: 80,
    height: 80,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    elevation: 3,
  },
  gridText: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#000",
  },
  statusText: {
    fontSize: 10,
    fontWeight: "bold",
    color: "#000",
    marginTop: 5,
  },
});
