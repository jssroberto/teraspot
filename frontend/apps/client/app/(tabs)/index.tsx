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
  StatusBar,
  Platform,
} from "react-native";
import Svg, { Polygon, Text as SvgText } from "react-native-svg";

export default function HomeScreen() {
  const [polygons, setPolygons] = useState<RoiSpace[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});

  // Navigation State
  const [facilities, setFacilities] = useState<string[]>([]);
  const [devicesByFacility, setDevicesByFacility] = useState<Record<string, string[]>>({});

  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
  const [selectedDevice, setSelectedDevice] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [viewMode, setViewMode] = useState<"map" | "grid">("map");

  const ASPECT_RATIO = 16 / 9;
  const HEADER_HEIGHT = Platform.OS === 'ios' ? 50 : 20;

  // 1. Initial Data Load (Facilities & Devices)
  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        setLoading(true);
        setErrorMsg(null);

        console.log("Fetching global status...");
        const spaces = await getParkingStatus(); // Fetch all data

        if (!active) return;

        // Group by Facility -> Devices
        const facilityMap: Record<string, Set<string>> = {};
        const statusMap: Record<string, string> = {};

        spaces.forEach((space: any) => {
          if (space.space_id && space.status) {
            statusMap[space.space_id] = space.status;
          }

          const facId = space.facility_id || "facility-1"; // Default fallbacks
          const devId = space.device_id; // Assumes backend returns device_id

          if (facId && devId) {
            if (!facilityMap[facId]) facilityMap[facId] = new Set();
            facilityMap[facId].add(devId);
          }
        });

        const sortedFacilities = Object.keys(facilityMap).sort();
        const groupedDevices: Record<string, string[]> = {};

        sortedFacilities.forEach(f => {
          groupedDevices[f] = Array.from(facilityMap[f]).sort();
        });

        console.log("Found facilities:", sortedFacilities);
        console.log("Device Map:", groupedDevices);

        if (sortedFacilities.length > 0) {
          setFacilities(sortedFacilities);
          setDevicesByFacility(groupedDevices);

          // Auto-select first facility & device
          if (!selectedFacility || !facilityMap[selectedFacility]) {
            const firstFac = sortedFacilities[0];
            setSelectedFacility(firstFac);

            // Select first device in that facility
            const firstDev = groupedDevices[firstFac]?.[0];
            if (firstDev) setSelectedDevice(firstDev);
          }

          setStatuses(statusMap);
        } else {
          setErrorMsg("No active facilities found. Check backend connection.");
        }

      } catch (err: any) {
        console.error("Init failed:", err);
        setErrorMsg(err.message || "Failed to load system.");
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => { active = false; };
  }, [refreshKey]);

  // 2. Load ROI when Device Changes
  useEffect(() => {
    if (!selectedDevice) return;

    const loadRoi = async () => {
      try {
        setLoadingConfig(true);
        console.log(`Loading config for ${selectedDevice}...`);
        const spaces = await getRoiConfig(selectedDevice);
        setPolygons(spaces);
      } catch (e) {
        console.error("ROI Load failed", e);
        setPolygons([]);
      } finally {
        setLoadingConfig(false);
      }
    };

    loadRoi();
  }, [selectedDevice]);

  // 3. WebSocket
  useEffect(() => {
    const wsUrl = process.env.EXPO_PUBLIC_WEBSOCKET_URL || "wss://vmdq0zxc18.execute-api.us-east-1.amazonaws.com/dev";
    if (!wsUrl) return;

    let ws: WebSocket | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout>;

    const connect = () => {
      ws = new WebSocket(wsUrl);
      ws.onopen = () => console.log("WS Connected");
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === "UPDATE" && msg.data) {
            const { space_id, status } = msg.data;
            setStatuses(p => ({ ...p, [space_id]: status }));
          }
        } catch (e) { /* ignore */ }
      };
      ws.onclose = () => {
        console.log("WS Closed, reconnecting...");
        reconnectTimeout = setTimeout(connect, 3000);
      };
      ws.onerror = (e) => console.log("WS Error");
    };
    connect();
    return () => { ws?.close(); clearTimeout(reconnectTimeout); };
  }, []);

  // UI Helpers
  const handleFacilitySelect = (fac: string) => {
    setSelectedFacility(fac);
    const devs = devicesByFacility[fac];
    if (devs && devs.length > 0) {
      setSelectedDevice(devs[0]); // Auto-select first camera
    } else {
      setSelectedDevice(null);
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
    return points.map(p => {
      const px = rect.x + p[0] * rect.width;
      const py = rect.y + p[1] * rect.height;
      return `${px},${py}`;
    }).join(" ");
  };

  const getLabelPosition = (points: number[][]) => {
    const rect = getDisplayedRect();
    let sumX = 0, sumY = 0;
    points.forEach(p => { sumX += p[0]; sumY += p[1]; });
    return {
      x: rect.x + (sumX / points.length) * rect.width,
      y: rect.y + (sumY / points.length) * rect.height
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

  if (loading && facilities.length === 0) {
    return (
      <ThemedView style={[styles.container, styles.center]}>
        <ActivityIndicator size="large" color="#0a7ea4" />
        <ThemedText style={{ marginTop: 20 }}>Finding Parking Spots...</ThemedText>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <StatusBar barStyle="light-content" />

      <View style={[styles.headerContainer, { paddingTop: HEADER_HEIGHT }]}>
        <ThemedText type="title" style={styles.appTitle}>TeraSpot</ThemedText>
        <ThemedText style={styles.subtitle}>Smart Parking Finder</ThemedText>
      </View>

      {/* Selectors */}
      <View style={styles.selectorContainer}>
        {/* Facility Selector */}
        <View style={styles.rowLabel}>
          <ThemedText type="defaultSemiBold">FACILITY</ThemedText>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
          {facilities.map(fac => (
            <TouchableOpacity
              key={fac}
              style={[styles.pill, selectedFacility === fac && styles.pillActive]}
              onPress={() => handleFacilitySelect(fac)}
            >
              <ThemedText style={[styles.pillText, selectedFacility === fac && styles.pillTextActive]}>
                {fac.toUpperCase()}
              </ThemedText>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Camera/Zone Selector (Only if facility selected) */}
        {selectedFacility && devicesByFacility[selectedFacility]?.length > 0 && (
          <>
            <View style={[styles.rowLabel, { marginTop: 15 }]}>
              <ThemedText type="defaultSemiBold">CAMERA / ZONE</ThemedText>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scrollRow}>
              {devicesByFacility[selectedFacility].map(dev => (
                <TouchableOpacity
                  key={dev}
                  style={[styles.pill, styles.pillSmall, selectedDevice === dev && styles.pillActive]}
                  onPress={() => setSelectedDevice(dev)}
                >
                  <ThemedText style={[styles.pillText, styles.pillTextSmall, selectedDevice === dev && styles.pillTextActive]}>
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
        <TouchableOpacity onPress={() => setRefreshKey(k => k + 1)} style={styles.errorBanner}>
          <ThemedText style={styles.errorText}>⚠️ {errorMsg} (Tap to Retry)</ThemedText>
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

          <TouchableOpacity style={styles.viewToggle} onPress={() => setViewMode(viewMode === "map" ? "grid" : "map")}>
            <ThemedText style={styles.viewToggleText}>{viewMode === "map" ? "GRID VIEW" : "MAP VIEW"}</ThemedText>
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
                <ThemedText style={{ color: '#666' }}>No ROI Configured</ThemedText>
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
                  <View key={index} style={[styles.gridItem, { backgroundColor: isOccupied ? "#ff4444" : "#00c853" }]}>
                    <ThemedText style={styles.gridId}>{id}</ThemedText>
                    <ThemedText style={styles.gridStatus}>{isOccupied ? "BUSY" : "FREE"}</ThemedText>
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
    backgroundColor: '#121212', // Dark background
  },
  center: {
    justifyContent: 'center',
    alignItems: 'center',
    flex: 1,
  },
  headerContainer: {
    paddingHorizontal: 20,
    paddingBottom: 15,
    backgroundColor: '#1e1e1e',
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  appTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: '#fff',
    letterSpacing: 0.5,
  },
  subtitle: {
    color: '#aaa',
    fontSize: 14,
    marginTop: 2,
  },
  selectorContainer: {
    paddingVertical: 15,
    paddingHorizontal: 20,
    backgroundColor: '#181818',
  },
  rowLabel: {
    marginBottom: 8,
  },
  scrollRow: {
    flexDirection: 'row',
  },
  pill: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: '#333',
    borderRadius: 12,
    marginRight: 12,
  },
  pillActive: {
    backgroundColor: '#0a7ea4', // Brand Blue
    shadowColor: '#0a7ea4',
    shadowOpacity: 0.4,
    shadowRadius: 5,
    elevation: 5,
  },
  pillText: {
    color: '#ccc',
    fontWeight: '600',
    fontSize: 14,
  },
  pillTextActive: {
    color: '#fff',
    fontWeight: 'bold',
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
    backgroundColor: '#3e1b1b',
    padding: 10,
    margin: 10,
    borderRadius: 8,
    alignItems: 'center',
  },
  errorText: {
    color: '#ff6b6b',
    fontWeight: 'bold',
  },
  contentArea: {
    flex: 1,
    backgroundColor: '#121212',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    marginTop: 5,
  },
  toolbar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  legend: {
    flexDirection: 'row',
    gap: 15,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  legendText: {
    color: '#aaa',
    fontSize: 12,
  },
  viewToggle: {
    backgroundColor: '#2a2a2a',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#444',
  },
  viewToggleText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
  },
  vizContainer: {
    flex: 1,
    marginHorizontal: 15,
    marginBottom: 20,
    backgroundColor: '#1f1f1f',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#333',
    overflow: 'hidden',
  },
  gridContainer: {
    flex: 1,
    paddingHorizontal: 15,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    paddingBottom: 40,
    justifyContent: 'center',
  },
  gridItem: {
    width: '30%',
    aspectRatio: 1,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 2,
  },
  gridId: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  gridStatus: {
    fontSize: 10,
    fontWeight: 'bold',
    color: 'rgba(255,255,255,0.8)',
  },
});
