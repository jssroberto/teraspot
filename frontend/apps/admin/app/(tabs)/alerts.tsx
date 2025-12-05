import { PageLayout } from "@/components/PageLayout";
import { ThemedCard } from "@/components/ThemedCard";
import { ThemedText } from "@/components/themed-text";
import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { getAlertConfig, saveAlertConfig } from "@repo/core";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Switch,
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
  const [refreshing, setRefreshing] = useState(false);

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
      if (!refreshing) setLoading(true);
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
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadConfig();
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
    row: {
      marginBottom: 16,
    },
    label: {
      marginBottom: 8,
      fontSize: 14,
      opacity: 0.7,
    },
    input: {
      backgroundColor: Platform.OS === "ios" ? "rgba(0,0,0,0.05)" : "#2C2C2C",
      color: theme.text,
      padding: 12,
      borderRadius: 8,
      fontSize: 16,
      borderWidth: 1,
      borderColor: "rgba(128,128,128,0.2)",
    },
    switchRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 16,
      paddingVertical: 4,
    },
    switchLabel: {
      fontSize: 16,
    },
    saveButton: {
      backgroundColor: theme.tint,
      padding: 16,
      borderRadius: 12,
      alignItems: "center",
      marginTop: 20,
      marginBottom: 40,
    },
    saveButtonText: {
      color: "#FFF",
      fontSize: 16,
      fontWeight: "bold",
    },
  });

  return (
    <PageLayout
      title="System Alerts"
      subtitle="Configure thresholds and notification channels"
      refreshing={refreshing}
      onRefresh={handleRefresh}
    >
      {loading && !refreshing ? (
        <View style={{ padding: 50, alignItems: "center" }}>
          <ActivityIndicator size="large" color={theme.tint} />
          <ThemedText style={{ marginTop: 20, opacity: 0.6 }}>
            Cargando configuración...
          </ThemedText>
        </View>
      ) : error ? (
        <View style={{ padding: 50, alignItems: "center" }}>
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
          <ThemedCard title="Thresholds">
            <View style={styles.row}>
              <ThemedText style={styles.label}>
                Critical Occupancy (%)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.icon },
                ]}
                value={occupancyThresholdCrit}
                onChangeText={setOccupancyThresholdCrit}
                keyboardType="numeric"
                placeholder="95"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>
                Warning Occupancy (%)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.icon },
                ]}
                value={occupancyThresholdWarn}
                onChangeText={setOccupancyThresholdWarn}
                keyboardType="numeric"
                placeholder="80"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>
                Confidence Threshold (0.0 - 1.0)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.icon },
                ]}
                value={confidenceThreshold}
                onChangeText={setConfidenceThreshold}
                keyboardType="numeric"
                placeholder="0.8"
                placeholderTextColor="#666"
              />
            </View>

            <View style={styles.row}>
              <ThemedText style={styles.label}>
                Inactive Timeout (Minutes)
              </ThemedText>
              <TextInput
                style={[
                  styles.input,
                  { color: theme.text, borderColor: theme.icon },
                ]}
                value={inactiveTimeout}
                onChangeText={setInactiveTimeout}
                keyboardType="numeric"
                placeholder="5"
                placeholderTextColor="#666"
              />
            </View>
          </ThemedCard>

          <ThemedCard title="Notification Channels" style={{ marginTop: 20 }}>
            <View style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>
                📧 Email Alerts (SNS)
              </ThemedText>
              <Switch
                value={emailEnabled}
                onValueChange={setEmailEnabled}
                trackColor={{ false: "#444", true: theme.tint }}
                thumbColor={emailEnabled ? "#FFF" : "#CCC"}
              />
            </View>

            <View style={styles.switchRow}>
              <ThemedText style={styles.switchLabel}>
                📱 App Notifications
              </ThemedText>
              <Switch
                value={appEnabled}
                onValueChange={setAppEnabled}
                trackColor={{ false: "#444", true: theme.tint }}
                thumbColor={appEnabled ? "#FFF" : "#CCC"}
              />
            </View>
          </ThemedCard>

          <TouchableOpacity
            style={[
              styles.saveButton,
              { backgroundColor: theme.tint },
              saving && { opacity: 0.7 },
            ]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <ThemedText style={styles.saveButtonText}>
                Save Configuration
              </ThemedText>
            )}
          </TouchableOpacity>
        </>
      )}
    </PageLayout>
  );
}
