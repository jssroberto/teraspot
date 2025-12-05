import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { KPICard } from "@/components/kpi-card";
import { OccupancyGauge } from "@/components/occupancy-gauge";
import { OccupancyTrendChart } from "@/components/occupancy-trend-chart";
import { PeakHoursChart } from "@/components/peak-hours-chart";
import { getKPIData, KPIResponse, getRecentAlerts } from "@repo/core";
import React, { useEffect, useState } from "react";
import {
  Alert,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  Platform,
  TouchableOpacity,
} from "react-native";
import { signOut } from "aws-amplify/auth";

export default function DashboardScreen() {
  const [kpiData, setKpiData] = useState<KPIResponse | null>(null);
  const [recentAlerts, setRecentAlerts] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { width: windowWidth } = useWindowDimensions();

  // Determine grid columns based on screen width
  const getGridColumns = () => {
    if (windowWidth >= 1200) return 4; // Desktop: 4 columns
    if (windowWidth >= 768) return 3; // Tablet: 3 columns
    if (windowWidth >= 600) return 2; // Small tablet: 2 columns
    return 1; // Mobile phone: 1 column
  };

  const gridColumns = getGridColumns();

  const fetchKPIData = async () => {
    setRefreshing(true);
    try {
      const data = await getKPIData({
        time_window_minutes: 1440, // 24 hours to capture data in low-traffic/dev environments
        days_back: 7,
      });
      const alerts = await getRecentAlerts(20);
      setKpiData(data);
      setRecentAlerts(alerts);
    } catch (error) {
      console.error("Error fetching KPI data:", error);
      Alert.alert("Error", "No se pudieron cargar los datos del dashboard");
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchKPIData();

    // WebSocket Connection
    const wsUrl = "wss://vmdq0zxc18.execute-api.us-east-1.amazonaws.com/dev";
    let ws: WebSocket | null = null;

    const connectWebSocket = () => {
      try {
        console.log("Connecting to WebSocket:", wsUrl);
        ws = new WebSocket(wsUrl);

        ws.onopen = () => {
          console.log("WebSocket Connected");
        };

        ws.onmessage = (event) => {
          try {
            const message = JSON.parse(event.data);
            console.log("WS Message:", message);

            if (message.type === "UPDATE") {
              // Refresh data on update
              fetchKPIData();
            } else if (
              message.type === "INACTIVE_SENSOR" ||
              message.type === "HIGH_OCCUPANCY" ||
              message.type === "LOW_CONFIDENCE"
            ) {
              // Prepend to internal log
              setRecentAlerts((prev) => [message, ...prev].slice(0, 20));
            }

            if (message.type === "INACTIVE_SENSOR") {
              Alert.alert(
                "⚠️ Sensor Inactivo",
                message.message ||
                  `Dispositivo ${message.device_id} sin respuesta`,
                [{ text: "OK" }]
              );
            } else if (message.type === "HIGH_OCCUPANCY") {
              Alert.alert(
                "🚨 Alta Ocupación",
                `Ocupación al ${message.occupancy_percent.toFixed(1)}%`,
                [{ text: "Ver Detalles" }, { text: "Cerrar" }]
              );
            }
          } catch (e) {
            console.error("Error parsing WS message", e);
          }
        };

        ws.onerror = (e) => {
          console.log("WebSocket Error:", e);
        };

        ws.onclose = () => {
          console.log("WebSocket Closed. Reconnecting in 5s...");
          setTimeout(connectWebSocket, 5000);
        };
      } catch (e) {
        console.error("WebSocket connection failed", e);
      }
    };

    connectWebSocket();

    // Backup polling every 5 minutes (instead of 1 min)
    const interval = setInterval(fetchKPIData, 300000);

    return () => {
      if (ws) ws.close();
      clearInterval(interval);
    };
  }, []);

  if (loading) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">Dashboard KPI</ThemedText>
        </View>
        <ThemedText style={styles.loadingText}>Cargando datos...</ThemedText>
      </ThemedView>
    );
  }

  if (!kpiData) {
    return (
      <ThemedView style={styles.container}>
        <View style={styles.header}>
          <ThemedText type="title">Dashboard KPI</ThemedText>
        </View>
        <ThemedText style={styles.errorText}>
          No hay datos disponibles
        </ThemedText>
      </ThemedView>
    );
  }

  const { level_1_operational, level_2_performance, level_3_analytics } =
    kpiData;

  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleString("es-ES", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  // Get status for cards
  const getHealthStatus = (status: string) => {
    switch (status) {
      case "HEALTHY":
        return "success";
      case "DEGRADED":
        return "warning";
      case "CRITICAL":
        return "error";
      default:
        return "info";
    }
  };

  const getConfidenceStatus = (status: string) => {
    switch (status) {
      case "EXCELLENT":
      case "GOOD":
        return "success";
      case "ACCEPTABLE":
        return "warning";
      case "POOR":
        return "error";
      default:
        return "info";
    }
  };

  const getLatencyStatus = (status: string) => {
    switch (status) {
      case "EXCELLENT":
        return "success";
      case "ACCEPTABLE":
        return "warning";
      case "DEGRADED":
        return "error";
      default:
        return "info";
    }
  };

  const getLowConfidenceStatus = (status: string) => {
    switch (status) {
      case "NORMAL":
        return "success";
      case "MONITOR":
        return "warning";
      case "ACTION_REQUIRED":
        return "error";
      default:
        return "info";
    }
  };

  const formatDuration = (hours: number) => {
    if (hours < 1) {
      const minutes = Math.round(hours * 60);
      return `${minutes}m`;
    }
    return `${hours.toFixed(1)}h`;
  };

  // Debug logging for system health
  const processorDebug = level_2_performance.system_health.device_list.find(
    (d) => d.device_id.includes("TeraSpot-Processor")
  );
  console.log("Processor Debug Info:", processorDebug);
  console.log(
    "All Inactive Devices:",
    level_2_performance.system_health.inactive_devices
  );

  // Check if the main processor is offline - checking device_list is more robust as it contains full status
  const isProcessorOffline = level_2_performance.system_health.device_list.some(
    (d) =>
      (d.device_id.includes("TeraSpot-Processor") ||
        d.device_id.includes("fog")) &&
      d.status === "inactive"
  );

  // Determine overall system status for the badge
  const systemStatusText = isProcessorOffline
    ? "SISTEMA OFFLINE"
    : "SISTEMA OK";
  const systemStatusColor = isProcessorOffline ? "#F44336" : "#4CAF50";
  const systemStatusBg = isProcessorOffline
    ? "rgba(244, 67, 54, 0.1)"
    : "rgba(76, 175, 80, 0.1)";

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchKPIData} />
        }
        contentContainerStyle={[
          styles.scrollContent,
          windowWidth >= 1400 && styles.scrollContentWide,
        ]}
      >
        <View
          style={[
            styles.contentContainer,
            windowWidth >= 1400 && styles.contentContainerWide,
          ]}
        >
          <View
            style={[styles.header, windowWidth < 600 && styles.headerMobile]}
          >
            <View style={{ flex: 1 }}>
              <ThemedText type="title">TeraSpot Dashboard</ThemedText>
              <ThemedText style={styles.subtitle}>
                Sistema Inteligente de Gestión de Estacionamientos
              </ThemedText>
            </View>
            <View
              style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
            >
              <ThemedText
                style={[
                  styles.systemStatus,
                  { color: systemStatusColor, backgroundColor: systemStatusBg },
                ]}
              >
                {systemStatusText}
              </ThemedText>
              <TouchableOpacity
                onPress={async () => {
                  try {
                    await signOut();
                  } catch (e) {
                    console.error("Error signing out", e);
                  }
                }}
                style={{
                  padding: 8,
                  backgroundColor: "#ff4444",
                  borderRadius: 8,
                }}
              >
                <ThemedText
                  style={{ color: "white", fontSize: 12, fontWeight: "bold" }}
                >
                  LOGOUT
                </ThemedText>
              </TouchableOpacity>
            </View>
          </View>

          {/* KPI Cards Grid */}
          <View style={[styles.grid, { marginHorizontal: -7.5 }]}>
            {/* Vacant Spaces */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="ESPACIOS DISPONIBLES"
                value={
                  isProcessorOffline
                    ? "N/A"
                    : level_1_operational.vacant_spaces.total_vacant
                }
                subtitle={
                  isProcessorOffline
                    ? "Sistema detenido"
                    : Object.entries(level_1_operational.vacant_spaces.by_zone)
                        .map(([zone, count]) => `${zone}: ${count}`)
                        .join(", ")
                }
                status={
                  isProcessorOffline
                    ? "error"
                    : level_1_operational.vacant_spaces.color_code === "GREEN"
                      ? "success"
                      : level_1_operational.vacant_spaces.color_code ===
                          "YELLOW"
                        ? "warning"
                        : "error"
                }
              />
            </View>

            {/* System Health */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="SALUD DEL SISTEMA"
                value={`${level_2_performance.system_health.uptime_percentage.toFixed(0)}%`}
                subtitle={`Uptime Dispositivos`}
                status={getHealthStatus(
                  level_2_performance.system_health.status
                )}
              >
                <ThemedText
                  style={[
                    styles.value,
                    {
                      color:
                        level_2_performance.system_health.status === "HEALTHY"
                          ? "#4CAF50"
                          : level_2_performance.system_health.status ===
                              "DEGRADED"
                            ? "#FF9800"
                            : "#F44336",
                    },
                  ]}
                >
                  {level_2_performance.system_health.uptime_percentage.toFixed(
                    0
                  )}
                  %
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {level_2_performance.system_health.active_devices} /{" "}
                  {level_2_performance.system_health.total_devices} activos
                </ThemedText>
                {level_2_performance.system_health.status === "HEALTHY" ? (
                  <ThemedText style={styles.statusLabel}>HEALTHY</ThemedText>
                ) : (
                  <ThemedText style={styles.statusLabel}>
                    {level_2_performance.system_health.status}
                  </ThemedText>
                )}

                {level_2_performance.system_health.device_list?.filter(
                  (d) => d.status === "inactive"
                ).length > 0 && (
                  <View style={{ marginTop: 12, width: "100%" }}>
                    <ThemedText
                      style={{
                        fontSize: 11,
                        fontWeight: "bold",
                        marginBottom: 4,
                        opacity: 0.7,
                      }}
                    >
                      Cámaras Inactivas:
                    </ThemedText>
                    {level_2_performance.system_health.device_list
                      .filter((d) => d.status === "inactive")
                      .map((device) => (
                        <View
                          key={device.device_id}
                          style={{
                            flexDirection: "row",
                            justifyContent: "space-between",
                            marginBottom: 2,
                          }}
                        >
                          <ThemedText
                            style={{ fontSize: 11, color: "#F44336" }}
                          >
                            • {device.device_id}
                          </ThemedText>
                        </View>
                      ))}
                  </View>
                )}
              </KPICard>
            </View>

            {/* Detection Confidence */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="CONFIANZA IA (YOLO)"
                value={
                  isProcessorOffline
                    ? "N/A"
                    : level_2_performance.detection_confidence.sample_size > 0
                      ? `${level_2_performance.detection_confidence.average_confidence.toFixed(1)}%`
                      : "N/A"
                }
                subtitle="Calidad (Solo Ocupados)"
                status={
                  isProcessorOffline
                    ? "info"
                    : getConfidenceStatus(
                        level_2_performance.detection_confidence.quality_status
                      )
                }
              >
                <ThemedText
                  style={[
                    styles.value,
                    {
                      color: isProcessorOffline
                        ? "#666"
                        : level_2_performance.detection_confidence
                              .quality_status === "EXCELLENT" ||
                            level_2_performance.detection_confidence
                              .quality_status === "GOOD"
                          ? "#4CAF50"
                          : level_2_performance.detection_confidence
                                .quality_status === "ACCEPTABLE"
                            ? "#FF9800"
                            : "#666",
                    },
                  ]}
                >
                  {isProcessorOffline
                    ? "N/A"
                    : level_2_performance.detection_confidence.sample_size > 0
                      ? `${level_2_performance.detection_confidence.average_confidence.toFixed(1)}%`
                      : "N/A"}
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isProcessorOffline
                    ? "Sin datos recientes"
                    : `Muestras (Ocupados): ${level_2_performance.detection_confidence.sample_size}`}
                </ThemedText>
                <ThemedText style={styles.statusLabel}>
                  {isProcessorOffline
                    ? "OFFLINE"
                    : level_2_performance.detection_confidence.quality_status}
                </ThemedText>
              </KPICard>
            </View>

            {/* Occupancy Rate */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard title="OCUPACIÓN ACTUAL">
                {isProcessorOffline ? (
                  <View
                    style={{
                      alignItems: "center",
                      justifyContent: "center",
                      height: 140,
                    }}
                  >
                    <ThemedText
                      style={{
                        fontSize: 24,
                        fontWeight: "bold",
                        color: "#666",
                      }}
                    >
                      OFFLINE
                    </ThemedText>
                  </View>
                ) : (
                  <OccupancyGauge
                    percentage={
                      level_1_operational.occupancy_rate.occupancy_rate
                    }
                    status={level_1_operational.occupancy_rate.status}
                  />
                )}
                <ThemedText style={styles.gaugeSubtitle}>
                  {isProcessorOffline
                    ? "Datos no disponibles"
                    : `${level_1_operational.occupancy_rate.occupied_spaces} / ${level_1_operational.occupancy_rate.total_spaces} espacios`}
                </ThemedText>
              </KPICard>
            </View>

            {/* Message Latency */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="LATENCIA MENSAJES"
                value={
                  isProcessorOffline
                    ? "N/A"
                    : level_2_performance.message_latency?.status !== "NO_DATA"
                      ? `${level_2_performance.message_latency?.average_latency_seconds.toFixed(3)}s`
                      : "N/A"
                }
                subtitle="Procesamiento E2E"
                status={
                  isProcessorOffline
                    ? "info"
                    : getLatencyStatus(
                        level_2_performance.message_latency?.status || "NO_DATA"
                      )
                }
              >
                <ThemedText style={styles.value}>
                  {isProcessorOffline
                    ? "N/A"
                    : level_2_performance.message_latency?.status !== "NO_DATA"
                      ? `${level_2_performance.message_latency?.average_latency_seconds.toFixed(3)}s`
                      : "N/A"}
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isProcessorOffline
                    ? ""
                    : `Max: ${level_2_performance.message_latency?.max_latency_seconds?.toFixed(3) || 0}s`}
                </ThemedText>
                <ThemedText style={styles.statusLabel}>
                  {isProcessorOffline
                    ? "OFFLINE"
                    : level_2_performance.message_latency?.status || "NO_DATA"}
                </ThemedText>
              </KPICard>
            </View>

            {/* Parking Duration */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="DURACIÓN PROMEDIO"
                value={
                  isProcessorOffline
                    ? "N/A"
                    : formatDuration(
                        level_3_analytics.parking_duration
                          .average_duration_hours
                      )
                }
                subtitle="Por Sesión"
                status={isProcessorOffline ? "info" : "info"}
              >
                <ThemedText style={styles.value}>
                  {isProcessorOffline
                    ? "N/A"
                    : formatDuration(
                        level_3_analytics.parking_duration
                          .average_duration_hours
                      )}
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isProcessorOffline
                    ? "Sin datos recientes"
                    : `Tipo: ${level_3_analytics.parking_duration.usage_type}`}
                </ThemedText>
                <ThemedText style={styles.statusLabel}>
                  {isProcessorOffline
                    ? "OFFLINE"
                    : `${level_3_analytics.parking_duration.sample_size} sesiones`}
                </ThemedText>
              </KPICard>
            </View>

            {/* Low Confidence Rate */}
            <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
              <KPICard
                title="TASA BAJA CONFIANZA"
                value={
                  isProcessorOffline
                    ? "N/A"
                    : `${level_2_performance.low_confidence_rate.low_confidence_rate.toFixed(1)}%`
                }
                subtitle={
                  isProcessorOffline
                    ? "Sistema detenido"
                    : `${level_2_performance.low_confidence_rate.low_confidence_count} eventos`
                }
                status={
                  isProcessorOffline
                    ? "info"
                    : getLowConfidenceStatus(
                        level_2_performance.low_confidence_rate.status
                      )
                }
              >
                <ThemedText style={styles.value}>
                  {isProcessorOffline
                    ? "N/A"
                    : `${level_2_performance.low_confidence_rate.low_confidence_rate.toFixed(1)}%`}
                </ThemedText>
                <ThemedText style={styles.subtitle}>
                  {isProcessorOffline
                    ? "Sin datos recientes"
                    : `${level_2_performance.low_confidence_rate.low_confidence_count} / ${level_2_performance.low_confidence_rate.total_events} eventos`}
                </ThemedText>
                <ThemedText style={styles.statusLabel}>
                  {isProcessorOffline
                    ? "OFFLINE"
                    : level_2_performance.low_confidence_rate.status}
                </ThemedText>
              </KPICard>
            </View>
          </View>

          {/* Recent Alerts Log */}
          <View style={styles.chartSection}>
            <ThemedText style={styles.chartTitle}>
              REGISTRO DE ALERTAS RECIENTES (ÚLTIMAS 20)
            </ThemedText>
            {recentAlerts.length === 0 ? (
              <ThemedText
                style={{ opacity: 0.5, textAlign: "center", padding: 20 }}
              >
                No hay alertas recientes
              </ThemedText>
            ) : (
              recentAlerts.map((alert, idx) => (
                <View
                  key={idx}
                  style={{
                    flexDirection: "row",
                    justifyContent: "space-between",
                    paddingVertical: 10,
                    borderBottomWidth: 1,
                    borderBottomColor: "#333",
                  }}
                >
                  <View>
                    <ThemedText style={{ fontWeight: "bold", fontSize: 14 }}>
                      {alert.type || "ALERTA"}
                    </ThemedText>
                    <ThemedText style={{ fontSize: 12, opacity: 0.7 }}>
                      {alert.message ||
                        `Space: ${alert.space_id || alert.device_id}`}
                    </ThemedText>
                  </View>
                  <View style={{ alignItems: "flex-end" }}>
                    <ThemedText style={{ fontSize: 12, opacity: 0.5 }}>
                      {new Date(alert.timestamp).toLocaleTimeString()}
                    </ThemedText>
                    <ThemedText
                      style={{
                        fontSize: 10,
                        fontWeight: "bold",
                        color:
                          alert.severity === "CRITICAL"
                            ? "#F44336"
                            : alert.severity === "WARNING"
                              ? "#FF9800"
                              : "#4CAF50",
                      }}
                    >
                      {alert.severity || "INFO"}
                    </ThemedText>
                  </View>
                </View>
              ))
            )}
          </View>

          {/* Occupancy Trend Chart */}
          <View style={styles.chartSection}>
            <ThemedText style={styles.chartTitle}>
              TENDENCIA DE OCUPACIÓN (ÚLTIMAS 24H)
            </ThemedText>
            <OccupancyTrendChart
              data={level_3_analytics.occupancy_trend.trend_data}
            />
          </View>

          {/* Peak Hours Chart */}
          <View style={styles.chartSection}>
            <ThemedText style={styles.chartTitle}>
              ANÁLISIS DE HORAS PICO (PROMEDIO HISTÓRICO)
            </ThemedText>
            <PeakHoursChart
              hourlyBreakdown={level_3_analytics.peak_hours.hourly_breakdown}
            />
            <ThemedText style={styles.chartSubtitle}>
              Datos de los últimos {level_3_analytics.peak_hours.days_analyzed}{" "}
              días
            </ThemedText>
          </View>

          {/* Footer Info */}
          <View style={styles.footer}>
            <ThemedText style={styles.footerText}>
              Última actualización:{" "}
              {formatTimestamp(kpiData.metadata.generated_at)}
            </ThemedText>
            <ThemedText style={styles.footerText}>
              Versión: {kpiData.metadata.version}
            </ThemedText>
          </View>
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
  systemStatus: {
    fontSize: 12,
    fontWeight: "bold",
    color: "#4CAF50",
    backgroundColor: "rgba(76, 175, 80, 0.1)",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "stretch",
  },
  gridItem: {
    paddingHorizontal: 7.5,
  },
  gaugeSubtitle: {
    textAlign: "center",
    marginTop: 12,
    fontSize: 14,
    opacity: 0.7,
  },
  value: {
    fontSize: 32,
    fontWeight: "bold",
    marginBottom: 4,
  },
  statusLabel: {
    fontSize: 12,
    fontWeight: "600",
    marginTop: 8,
    opacity: 0.7,
  },
  chartSection: {
    marginTop: 20,
    padding: 15,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.1)",
  },
  chartTitle: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 15,
    opacity: 0.7,
  },
  chartSubtitle: {
    fontSize: 12,
    opacity: 0.5,
    textAlign: "center",
    marginTop: 10,
  },
  footer: {
    marginTop: 30,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E0E0E0",
    alignItems: "center",
  },
  footerText: {
    fontSize: 11,
    opacity: 0.5,
    marginBottom: 4,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 50,
    opacity: 0.5,
  },
  errorText: {
    textAlign: "center",
    marginTop: 50,
    opacity: 0.5,
    color: "#F44336",
  },
});
