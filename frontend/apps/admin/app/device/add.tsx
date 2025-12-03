import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { addDevice } from "@repo/core";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    TextInput,
    View,
} from "react-native";

export default function AddDeviceScreen() {
    const router = useRouter();
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        device_id: "",
        ip: "",
        video_source: "",
        username: "",
        password: "",
    });

    const handleChange = (key: string, value: string) => {
        setFormData((prev) => ({ ...prev, [key]: value }));
    };

    const handleSubmit = async () => {
        if (!formData.device_id || !formData.name) {
            Alert.alert("Error", "Device ID and Name are required");
            return;
        }

        setLoading(true);
        try {
            await addDevice(formData);
            Alert.alert("Success", "Device added successfully", [
                { text: "OK", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error(error);
            Alert.alert("Error", "Failed to add device");
        } finally {
            setLoading(false);
        }
    };

    return (
        <ThemedView style={styles.container}>
            <ThemedText type="title" style={styles.title}>
                Add New Device
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

                <ThemedText>Device ID *</ThemedText>
                <TextInput
                    style={styles.input}
                    value={formData.device_id}
                    onChangeText={(text) => handleChange("device_id", text)}
                    placeholder="e.g. cam-01"
                    placeholderTextColor="#666"
                    autoCapitalize="none"
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
                    {loading ? (
                        <ActivityIndicator size="large" color="#0a7ea4" />
                    ) : (
                        <Button title="Add Device" onPress={handleSubmit} />
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
        color: "white", // Assuming dark theme based on ThemedView
        backgroundColor: "#333",
    },
    buttonContainer: {
        marginTop: 20,
    },
});
