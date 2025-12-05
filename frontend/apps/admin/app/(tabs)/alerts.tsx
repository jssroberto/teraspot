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
      Alert.alert("Error", "Failed to load configuration");
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
      marginBottom: 20,
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
      fontSize: 18,
      fontWeight: "600",
      color: theme.text,
      marginBottom: 15,
      borderBottomWidth: 1,
      borderBottomColor: "#333",
      paddingBottom: 10,
    },
    row: {
      marginBottom: 15,
    },
    label: {
      fontSize: 14,
      color: "#CCC",
      marginBottom: 8,
    },
    input: {
      backgroundColor: "#2C2C2C",
      color: "#FFF",
      borderRadius: 8,
      padding: 12,
      fontSize: 16,
      borderWidth: 1,
      borderColor: "#444",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 15,
    },
    switchLabel: {
      fontSize: 16,
      color: "#FFF",
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
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: theme.background,
    },
  });

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={theme.tint} />
      </View>
    );
  }

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
              <Text style={styles.label}>Confidence Threshold (0.0 - 1.0)</Text>
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
        </ScrollView>
      </KeyboardAvoidingView>
    </>
  );
}
