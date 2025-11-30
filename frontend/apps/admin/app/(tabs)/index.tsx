import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { deleteDevice, Device, getDevices } from "@repo/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  RefreshControl,
  Button as RNButton,
  StyleSheet,
  View,
} from "react-native";

export default function DashboardScreen() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const router = useRouter();

  const handleDelete = (deviceId: string) => {
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
              fetchDevices();
            } catch {
              Alert.alert("Error", "Failed to delete device");
            }
          },
        },
      ]
    );
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

  const renderItem = ({ item }: { item: Device }) => (
    <ThemedView style={styles.card}>
      <View style={styles.cardHeader}>
        <ThemedText type="subtitle">
          {item.value.name || "Unnamed Device"}
        </ThemedText>
        <ThemedText>{item.value.device_id}</ThemedText>
      </View>
      <ThemedText>IP: {item.value.ip}</ThemedText>
      <ThemedText>Source: {item.value.video_source}</ThemedText>

      <View style={styles.buttonContainer}>
        <RNButton
          title="Manage / ROI"
          onPress={() => router.push(`/editor/${item.value.device_id}` as any)}
        />
        <View style={{ height: 10 }} />
        <RNButton
          title="Delete"
          color="red"
          onPress={() => handleDelete(item.value.device_id)}
        />
      </View>
    </ThemedView>
  );

  return (
    <ThemedView style={styles.container}>
      <View style={styles.header}>
        <ThemedText type="title">Edge Processors</ThemedText>
        {/* TODO: Add Device Screen implementation */}
        <RNButton
          title="Add Device"
          onPress={() =>
            Alert.alert("Not Implemented", "Add Device screen not migrated yet")
          }
        />
      </View>

      <FlatList
        data={devices}
        renderItem={renderItem}
        keyExtractor={(item) => item.config_id}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchDevices} />
        }
        ListEmptyComponent={
          <ThemedText style={styles.emptyText}>
            No devices found. Add one to get started.
          </ThemedText>
        }
        contentContainerStyle={styles.listContent}
      />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    marginTop: 40, // Safe area
  },
  card: {
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#ccc",
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  buttonContainer: {
    marginTop: 10,
  },
  emptyText: {
    textAlign: "center",
    marginTop: 50,
  },
  listContent: {
    paddingBottom: 20,
  },
});
