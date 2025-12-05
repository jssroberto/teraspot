import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { deleteDevice, Device, getDevices } from "@repo/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  Button as RNButton,
  StyleSheet,
  View,
  Platform,
  useWindowDimensions,
  TouchableOpacity,
} from "react-native";

export default function CamerasScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();
  const { width: windowWidth } = useWindowDimensions();

  // Determine grid columns based on screen width
  const getGridColumns = () => {
    if (windowWidth >= 1200) return 3; // Desktop: 3 columns
    if (windowWidth >= 768) return 2;  // Tablet: 2 columns
    return 1; // Mobile: 1 column
  };

  const gridColumns = getGridColumns();

  const handleDelete = async (deviceId: string) => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to delete this device?")) {
        try {
          await deleteDevice(deviceId);
          // Small delay to allow S3/Backend to propagate
          setTimeout(fetchDevices, 500);
        } catch (e) {
          console.error("Delete failed", e);
          alert("Failed to delete device");
        }
      }
    } else {
      Alert.alert(
        "Delete Device",
        "Are you sure you want to delete this device?",
        [
          { text: "Cancel", style: "cancel" },
          {
            text: "Delete",
            style: "destructive",
            onPress: async () => {
              try {
                await deleteDevice(deviceId);
                setTimeout(fetchDevices, 500);
              } catch {
                Alert.alert("Error", "Failed to delete device");
              }
            },
          },
        ]
      );
    }
  };

  const fetchDevices = async () => {
    setRefreshing(true);
    try {
      const deviceList = await getDevices();
      setDevices(deviceList);
    } catch (error) {
      console.error(error);
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, []);

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchDevices} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          windowWidth >= 1400 && styles.scrollContentWide,
        ]}
      >
        <View style={[styles.contentContainer, windowWidth >= 1400 && styles.contentContainerWide]}>
          <View style={[styles.header, windowWidth < 600 && styles.headerMobile]}>
            <View style={{ flex: 1 }}>
              <ThemedText type="title">Edge Processors</ThemedText>
              <ThemedText style={styles.subtitle}>
                Manage your camera devices and ROI configurations
              </ThemedText>
            </View>
            <TouchableOpacity
              onPress={() => router.push("/device/add")}
              style={styles.addButton}
            >
              <ThemedText style={styles.addButtonText}>+ Add Device</ThemedText>
            </TouchableOpacity>
          </View>

          {devices.length === 0 ? (
            <ThemedText style={styles.emptyText}>
              No devices found. Add one to get started.
            </ThemedText>
          ) : (
            <View style={[styles.grid, { marginHorizontal: -7.5 }]}>
              {devices.map((item) => (
                <View
                  key={item.config_id}
                  style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}
                >
                  <ThemedView style={styles.card}>
                    <View style={styles.cardHeader}>
                      <View style={{ flex: 1 }}>
                        <ThemedText style={styles.deviceName}>
                          {item.value.name || "Unnamed Device"}
                        </ThemedText>
                        <ThemedText style={styles.deviceId}>
                          {item.value.device_id}
                        </ThemedText>
                      </View>
                      <View style={styles.statusBadge}>
                        <View style={styles.statusDot} />
                        <ThemedText style={styles.statusText}>Active</ThemedText>
                      </View>
                    </View>

                    <View style={styles.deviceInfo}>
                      <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>IP Address</ThemedText>
                        <ThemedText style={styles.infoValue}>{item.value.ip}</ThemedText>
                      </View>
                      <View style={styles.infoRow}>
                        <ThemedText style={styles.infoLabel}>Video Source</ThemedText>
                        <ThemedText style={styles.infoValue} numberOfLines={1}>
                          {item.value.video_source}
                        </ThemedText>
                      </View>
                    </View>

                    <View style={styles.actionButtons}>
                      <TouchableOpacity
                        style={[styles.button, styles.primaryButton]}
                        onPress={() => router.push(`/editor/${item.value.device_id}` as any)}
                      >
                        <ThemedText style={styles.primaryButtonText}>
                          Manage ROI
                        </ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.secondaryButton]}
                        onPress={() => router.push(`/device/edit/${item.value.device_id}` as any)}
                      >
                        <ThemedText style={styles.secondaryButtonText}>
                          Edit
                        </ThemedText>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.dangerButton]}
                        onPress={() => handleDelete(item.value.device_id)}
                      >
                        <ThemedText style={styles.dangerButtonText}>
                          Delete
                        </ThemedText>
                      </TouchableOpacity>
                    </View>
                  </ThemedView>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
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
    paddingTop: 30,
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
    marginTop: 40,
  },
  headerMobile: {
    flexDirection: "column",
    alignItems: "flex-start",
    gap: 12,
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.6,
    marginTop: 4,
  },
  addButton: {
    backgroundColor: "#4CAF50",
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  addButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  gridItem: {
    paddingHorizontal: 7.5,
    marginBottom: 15,
  },
  card: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
    height: "100%",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.05)",
  },
  deviceName: {
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 4,
  },
  deviceId: {
    fontSize: 12,
    opacity: 0.5,
    fontFamily: Platform.OS === "ios" ? "Menlo" : "monospace",
  },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#4CAF50",
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#4CAF50",
  },
  deviceInfo: {
    marginBottom: 20,
    gap: 12,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoLabel: {
    fontSize: 13,
    opacity: 0.6,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: "500",
    flex: 1,
    textAlign: "right",
    marginLeft: 12,
  },
  actionButtons: {
    gap: 10,
  },
  button: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  primaryButton: {
    backgroundColor: "#2196F3",
  },
  primaryButtonText: {
    color: "white",
    fontSize: 14,
    fontWeight: "700",
  },
  secondaryButton: {
    backgroundColor: "rgba(255, 152, 0, 0.1)",
    borderWidth: 1,
    borderColor: "#FF9800",
  },
  secondaryButtonText: {
    color: "#FF9800",
    fontSize: 14,
    fontWeight: "700",
  },
  dangerButton: {
    backgroundColor: "rgba(244, 67, 54, 0.1)",
    borderWidth: 1,
    borderColor: "#F44336",
  },
  dangerButtonText: {
    color: "#F44336",
    fontSize: 14,
    fontWeight: "700",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
    opacity: 0.5,
  },
});

