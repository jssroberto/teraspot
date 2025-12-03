import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { addDevice, getDevices } from "@repo/core";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

export default function EditDeviceScreen() {
    const { deviceId } = useLocalSearchParams<{ deviceId: string }>();
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        device_id: "",
        ip: "",
        video_source: "",
        username: "",
        password: "",
    });

    useEffect(() => {
        loadDevice();
    }, [deviceId]);

    const loadDevice = async () => {
        try {
            const devices = await getDevices();
            const device = devices.find((d) => d.value.device_id === deviceId);
            if (device) {
                setFormData({
                    name: device.value.name || "",
                    device_id: device.value.device_id,
                    ip: device.value.ip || "",
                    video_source: device.value.video_source || "",
                    username: device.value.username || "",
                    password: device.value.password || "",
                });
            } else {
                Alert.alert("Error", "Device not found");
                router.back();
            }
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to load device");
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.device_id || !formData.name) {
            Alert.alert("Error", "Device ID and Name are required");
            return;
        }

        setSaving(true);
        try {
            // addDevice acts as upsert/save
            await addDevice(formData);
            Alert.alert("Success", "Device updated successfully", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to update device");
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <ThemedView style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#0a7ea4" />
            </ThemedView>
        );
    }

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>
                Edit Device
            </ThemedText>

            <View style={styles.form}>
                <ThemedText>Name *</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.name}
                    onChangeText={(text) => handleChange("name", text)}
                    placeholder="e.g. Main Entrance Camera"
                    placeholderTextColor="#666"
                />

                <ThemedText>Device ID (Read Only)</ThemedText>
                <TextInput
                    style={[styles.input, styles.disabledInput]}
                    value={formData.device_id}
                    editable={false}
                />

                <ThemedText>IP Address</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.ip}
                    onChangeText={(text) => handleChange("ip", text)}
                    placeholder="e.g. 192.168.1.100"
                    placeholderTextColor="#666"
                />

                <ThemedText>Video Source (RTSP URL)</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.video_source}
                    onChangeText={(text) => handleChange("video_source", text)}
                    placeholder="rtsp://..."
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                />

                <ThemedText>Username</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.username}
                    onChangeText={(text) => handleChange("username", text)}
                    placeholder="Camera Username"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
                />

                <ThemedText>Password</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.password}
                    onChangeText={(text) => handleChange("password", text)}
                    placeholder="Camera Password"
                    placeholderTextColor="#666"
                    secureTextEntry
                />

                <View style={styles.buttonContainer}>
                    {saving ? (
                        <ActivityIndicator size="large" color="#0a7ea4" />
                    ) : (
                        <Button title="Save Changes" onPress={handleSubmit} />
                    )}
                </View>
            </View>
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 20,
    },
    center: {
        justifyContent: "center",
        alignItems: "center",
    },
    title: {
        marginBottom: 20,
    },
    form: {
        gap: 15,
    },
    input: {
        borderWidth: 1,
        borderColor: "#ccc",
        borderRadius: 5,
        padding: 10,
        color: "white",
        backgroundColor: "#333",
    },
    disabledInput: {
        backgroundColor: "#555",
        color: "#aaa",
    },
    buttonContainer: {
        marginTop: 20,
    },
});
