import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getAlertConfig, saveAlertConfig } from "@repo/core";
import { Stack } from "expo-router";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function AlertsScreen() {
  const colorScheme = useColorScheme() ?? "dark"; // Force dark if undefined
  const theme = Colors[colorScheme];
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(false);

  // Config State
  const [occupancyThresholdCrit, setOccupancyThresholdCrit] = useState("95");
  const [occupancyThresholdWarn, setOccupancyThresholdWarn] = useState("80");
  const [confidenceThreshold, setConfidenceThreshold] = useState("0.8");
  const [inactiveTimeout, setInactiveTimeout] = useState("5");
  const [emailEnabled, setEmailEnabled] = useState(true);
  const [appEnabled, setAppEnabled] = useState(true);

  // Load Config
  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    try {
      setLoading(true);
      setError(false);
      const config = await getAlertConfig();
      if (config && Object.keys(config).length > 0) {
        setOccupancyThresholdCrit(
          String(config.occupancy_threshold_critical || 95)
        );
        setOccupancyThresholdWarn(
          String(config.occupancy_threshold_warning || 80)
        );
        setConfidenceThreshold(String(config.confidence_threshold || 0.8));
        setInactiveTimeout(String(config.inactive_timeout_minutes || 5));
        setEmailEnabled(config.channels?.email ?? true);
        setAppEnabled(config.channels?.app ?? true);
      }
    } catch (error) {
      console.error("Failed to load config:", error);
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const payload = {
        occupancy_threshold_critical: parseFloat(occupancyThresholdCrit),
        occupancy_threshold_warning: parseFloat(occupancyThresholdWarn),
        confidence_threshold: parseFloat(confidenceThreshold),
        inactive_timeout_minutes: parseInt(inactiveTimeout, 10),
        channels: {
          email: emailEnabled,
          app: appEnabled,
        },
      };

      await saveAlertConfig(payload);
      Alert.alert("Success", "Configuration saved successfully");
    } catch (error) {
      console.error("Failed to save config:", error);
      Alert.alert("Error", "Failed to save configuration");
    } finally {
      setSaving(false);
    }
  };

  const styles = StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: theme.background,
    },
    scrollView: {
      padding: 20,
    },
    header: {
      marginBottom: 20,
    },
    title: {
      marginBottom: 5,
    },
    subtitle: {
      fontSize: 14,
      color: "#888",
    },
    card: {
      backgroundColor: "#1E1E1E", // Dark card
      borderRadius: 12,
      padding: 16,
      marginBottom: 20,
      borderWidth: 1,
      borderColor: "#333",
    },
    cardTitle: {
      marginBottom: 16,
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
    },
    row: {
      marginBottom: 16,
    },
    label: {
      color: "#CCC",
      marginBottom: 8,
      fontSize: 14,
    },
    input: {
      backgroundColor: "#2C2C2C",
      color: "#FFF",
      padding: 12,
      borderRadius: 8,
      fontSize: 16,
      borderWidth: 1,
      borderColor: "#444",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingVertical: 4,
    },
    switchLabel: {
      color: "#FFF",
      fontSize: 16,
    },
    saveButton: {
      backgroundColor: theme.tint,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 10,
    },
    saveButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "bold",
    },
    loadingContainer: {
      padding: 50,
      alignItems: "center",
    },
  });

  return (
    <>
      <Stack.Screen
        options={{ title: "Alert Configuration", headerShown: true }}
      />
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <ScrollView contentContainerStyle={styles.scrollView}>
          <View style={styles.header}>
            <ThemedText type="title" style={styles.title}>
              System Alerts
            </ThemedText>
            <ThemedText style={styles.subtitle}>
              Configure thresholds and notification channels
            </ThemedText>
          </View>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={theme.tint} />
              <ThemedText style={{ marginTop: 20, opacity: 0.6 }}>
                Cargando configuración...
              </ThemedText>
            </View>
          ) : error ? (
            <View style={styles.loadingContainer}>
              <ThemedText style={{ opacity: 0.6, marginBottom: 20 }}>
                No se pudo cargar la configuración
              </ThemedText>
              <TouchableOpacity
                onPress={loadConfig}
                style={{
                  paddingHorizontal: 20,
                  paddingVertical: 10,
                  backgroundColor: theme.tint,
                  borderRadius: 8,
                }}
              >
                <ThemedText style={{ color: "white", fontWeight: "bold" }}>
                  Reintentar
                </ThemedText>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <ThemedText type="subtitle" style={styles.cardTitle}>
                  Thresholds
                </ThemedText>

                <View style={styles.row}>
                  <Text style={styles.label}>Critical Occupancy (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={occupancyThresholdCrit}
                    onChangeText={setOccupancyThresholdCrit}
                    keyboardType="numeric"
                    placeholder="95"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Warning Occupancy (%)</Text>
                  <TextInput
                    style={styles.input}
                    value={occupancyThresholdWarn}
                    onChangeText={setOccupancyThresholdWarn}
                    keyboardType="numeric"
                    placeholder="80"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>
                    Confidence Threshold (0.0 - 1.0)
                  </Text>
                  <TextInput
                    style={styles.input}
                    value={confidenceThreshold}
                    onChangeText={setConfidenceThreshold}
                    keyboardType="numeric"
                    placeholder="0.8"
                    placeholderTextColor="#666"
                  />
                </View>

                <View style={styles.row}>
                  <Text style={styles.label}>Inactive Timeout (Minutes)</Text>
                  <TextInput
                    style={styles.input}
                    value={inactiveTimeout}
                    onChangeText={setInactiveTimeout}
                    keyboardType="numeric"
                    placeholder="5"
                    placeholderTextColor="#666"
                  />
                </View>
              </View>

              <View style={styles.card}>
                <ThemedText type="subtitle" style={styles.cardTitle}>
                  Notification Channels
                </ThemedText>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📧 Email Alerts (SNS)</Text>
                  <Switch
                    value={emailEnabled}
                    onValueChange={setEmailEnabled}
                    trackColor={{ false: "#444", true: theme.tint }}
                    thumbColor={emailEnabled ? "#FFF" : "#CCC"}
                  />
                </View>

                <View style={styles.switchRow}>
                  <Text style={styles.switchLabel}>📱 App Notifications</Text>
                  <Switch
                    value={appEnabled}
                    onValueChange={setAppEnabled}
                    trackColor={{ false: "#444", true: theme.tint }}
                    thumbColor={appEnabled ? "#FFF" : "#CCC"}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={[styles.saveButton, saving && { opacity: 0.7 }]}
                onPress={handleSave}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFF" />
                ) : (
                  <Text style={styles.saveButtonText}>Save Configuration</Text>
                )}
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
