import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { deleteDevice, Device, getDevices } from "@repo/core";
import { useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";

export default function CamerasScreen() {
    const [devices, setDevices] = useState<Device[]>([]);
    const [refreshing, setRefreshing] = useState(false);
    const router = useRouter();
    const { width } = useWindowDimensions();

    const isLargeScreen = width >= 768;

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
        <View style={[styles.card, isLargeScreen && styles.cardLarge]}>
            <View style={styles.cardHeader}>
                <View>
                    <ThemedText type="subtitle" style={styles.deviceName}>
                        {item.value.name || "Unnamed Device"}
                    </ThemedText>
                    <ThemedText style={styles.deviceId}>{item.value.device_id}</ThemedText>
                </View>
                <View style={styles.statusBadge}>
                    <ThemedText style={styles.statusText}>ACTIVE</ThemedText>
                </View>
            </View>

            <View style={styles.cardBody}>
                <View style={styles.infoRow}>
                    <ThemedText style={styles.label}>IP Address:</ThemedText>
                    <ThemedText style={styles.value}>{item.value.ip}</ThemedText>
                </View>
                <View style={styles.infoRow}>
                    <ThemedText style={styles.label}>Source:</ThemedText>
                    <ThemedText style={styles.value} numberOfLines={1} ellipsizeMode="middle">{item.value.video_source}</ThemedText>
                </View>
            </View>

            <View style={styles.actionButtons}>
                <TouchableOpacity
                    style={[styles.button, styles.primaryButton]}
                    onPress={() => router.push(`/editor/${item.value.device_id}` as any)}
                >
                    <ThemedText style={styles.buttonText}>Manage ROI</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.secondaryButton]}
                    onPress={() => router.push(`/device/edit/${item.value.device_id}` as any)}
                >
                    <ThemedText style={styles.secondaryButtonText}>Edit</ThemedText>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.button, styles.dangerButton]}
                    onPress={() => handleDelete(item.value.device_id)}
                >
                    <ThemedText style={styles.dangerButtonText}>Delete</ThemedText>
                </TouchableOpacity>
            </View>
        </View>
    );

    return (
        <ThemedView style={styles.container}>
            <View style={styles.header}>
                <View>
                    <ThemedText type="title" style={styles.pageTitle}>Cameras</ThemedText>
                    <ThemedText style={styles.pageSubtitle}>Manage your edge processors and video sources</ThemedText>
                </View>
                <TouchableOpacity
                    style={styles.addButton}
                    onPress={() => router.push("/device/add")}
                >
                    <ThemedText style={styles.addButtonText}>+ Add Device</ThemedText>
                </TouchableOpacity>
            </View>

            <FlatList
                data={devices}
                renderItem={renderItem}
                keyExtractor={(item) => item.config_id}
                refreshControl={
                    <RefreshControl refreshing={refreshing} onRefresh={fetchDevices} tintColor="#fff" />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <ThemedText style={styles.emptyText}>
                            No devices found. Add one to get started.
                        </ThemedText>
                    </View>
                }
                contentContainerStyle={styles.listContent}
                numColumns={isLargeScreen ? 2 : 1}
                columnWrapperStyle={isLargeScreen ? styles.columnWrapper : undefined}
                key={isLargeScreen ? 'grid' : 'list'} // Force re-render when changing columns
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
        marginBottom: 30,
        marginTop: 20,
    },
    pageTitle: {
        fontSize: 32,
        fontWeight: "bold",
    },
    pageSubtitle: {
        opacity: 0.6,
        marginTop: 5,
    },
    addButton: {
        backgroundColor: "#2196F3",
        paddingHorizontal: 20,
        paddingVertical: 12,
        borderRadius: 8,
    },
    addButtonText: {
        color: "white",
        fontWeight: "600",
    },
    listContent: {
        paddingBottom: 20,
    },
    columnWrapper: {
        gap: 20,
    },
    card: {
        backgroundColor: "#1E1E1E",
        borderRadius: 12,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "#333",
        overflow: "hidden",
        flex: 1,
    },
    cardLarge: {
        marginBottom: 0, // Handled by gap in columnWrapper
    },
    cardHeader: {
        padding: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-start",
    },
    deviceName: {
        fontSize: 18,
        fontWeight: "600",
        color: "#fff",
    },
    deviceId: {
        fontSize: 12,
        color: "#888",
        marginTop: 4,
        fontFamily: "monospace",
    },
    statusBadge: {
        backgroundColor: "rgba(76, 175, 80, 0.2)",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        color: "#4CAF50",
        fontSize: 10,
        fontWeight: "bold",
    },
    cardBody: {
        padding: 20,
    },
    infoRow: {
        flexDirection: "row",
        marginBottom: 8,
    },
    label: {
        color: "#888",
        width: 80,
        fontSize: 14,
    },
    value: {
        color: "#ccc",
        flex: 1,
        fontSize: 14,
    },
    actionButtons: {
        flexDirection: "row",
        padding: 15,
        backgroundColor: "#252525",
        gap: 10,
    },
    button: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 6,
        alignItems: "center",
        justifyContent: "center",
    },
    primaryButton: {
        backgroundColor: "#2196F3",
    },
    secondaryButton: {
        backgroundColor: "transparent",
        borderWidth: 1,
        borderColor: "#555",
    },
    dangerButton: {
        backgroundColor: "rgba(244, 67, 54, 0.1)",
    },
    buttonText: {
        color: "white",
        fontWeight: "600",
        fontSize: 13,
    },
    secondaryButtonText: {
        color: "#ccc",
        fontWeight: "600",
        fontSize: 13,
    },
    dangerButtonText: {
        color: "#F44336",
        fontWeight: "600",
        fontSize: 13,
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        padding: 50,
    },
    emptyText: {
        opacity: 0.5,
    },
});
