import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { KPICard } from "@/components/kpi-card";
import { OccupancyGauge } from "@/components/occupancy-gauge";
import { OccupancyTrendChart } from "@/components/occupancy-trend-chart";
import { PeakHoursChart } from "@/components/peak-hours-chart";
import { getKPIData, KPIResponse } from "@repo/core";
import React, { useEffect, useState } from "react";
import {
    Alert,
    RefreshControl,
    ScrollView,
    StyleSheet,
    View,
    useWindowDimensions,
    Platform,
} from "react-native";

export default function DashboardScreen() {
    const [kpiData, setKpiData] = useState<KPIResponse | null>(null);
    const [refreshing, setRefreshing] = useState(false);
    const [loading, setLoading] = useState(true);
    const { width: windowWidth } = useWindowDimensions();

    // Determine grid columns based on screen width
    const getGridColumns = () => {
        if (windowWidth >= 1200) return 4; // Desktop: 4 columns
        if (windowWidth >= 768) return 3;  // Tablet: 3 columns
        if (windowWidth >= 600) return 2;  // Small tablet: 2 columns
        return 1; // Mobile phone: 1 column
    };

    const gridColumns = getGridColumns();

    const fetchKPIData = async () => {
        setRefreshing(true);
        try {
            const data = await getKPIData({
                time_window_minutes: 60,
                days_back: 7,
            });
            setKpiData(data);
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

        // Auto-refresh every 60 seconds
        const interval = setInterval(fetchKPIData, 60000);
        return () => clearInterval(interval);
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
                <View style={[styles.contentContainer, windowWidth >= 1400 && styles.contentContainerWide]}>
                    <View style={[styles.header, windowWidth < 600 && styles.headerMobile]}>
                        <View style={{ flex: 1 }}>
                            <ThemedText type="title">TeraSpot Dashboard</ThemedText>
                            <ThemedText style={styles.subtitle}>
                                Sistema Inteligente de Gestión de Estacionamientos
                            </ThemedText>
                        </View>
                        <ThemedText style={styles.systemStatus}>SISTEMA OK</ThemedText>
                    </View>

                    {/* KPI Cards Grid */}
                    <View style={[styles.grid, { marginHorizontal: -7.5 }]}>
                        {/* Vacant Spaces */}
                        <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
                            <KPICard
                                title="ESPACIOS DISPONIBLES"
                                value={level_1_operational.vacant_spaces.total_vacant}
                                subtitle={Object.entries(
                                    level_1_operational.vacant_spaces.by_zone
                                )
                                    .map(([zone, count]) => `${zone}: ${count}`)
                                    .join(", ")}
                                status={
                                    level_1_operational.vacant_spaces.color_code === "GREEN"
                                        ? "success"
                                        : level_1_operational.vacant_spaces.color_code === "YELLOW"
                                            ? "warning"
                                            : "error"
                                }
                            />
                        </View>

                        {/* Occupancy Rate */}
                        <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
                            <KPICard title="OCUPACIÓN ACTUAL">
                                <OccupancyGauge
                                    percentage={level_1_operational.occupancy_rate.occupancy_rate}
                                    status={level_1_operational.occupancy_rate.status}
                                />
                                <ThemedText style={styles.gaugeSubtitle}>
                                    {level_1_operational.occupancy_rate.occupied_spaces} /{" "}
                                    {level_1_operational.occupancy_rate.total_spaces} espacios
                                </ThemedText>
                            </KPICard>
                        </View>

                        {/* System Health */}
                        <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
                            <KPICard
                                title="SALUD DEL SISTEMA"
                                value={`${level_2_performance.system_health.uptime_percentage.toFixed(0)}%`}
                                subtitle={`Uptime Dispositivos`}
                                status={getHealthStatus(level_2_performance.system_health.status)}
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
                            </KPICard>
                        </View>

                        {/* Detection Confidence */}
                        <View style={[styles.gridItem, { width: `${100 / gridColumns}%` }]}>
                            <KPICard
                                title="CONFIANZA IA (YOLO)"
                                value={
                                    level_2_performance.detection_confidence.sample_size > 0
                                        ? `${(level_2_performance.detection_confidence.average_confidence * 100).toFixed(1)}%`
                                        : "N/A"
                                }
                                subtitle="Calidad de Detección"
                                status={getConfidenceStatus(
                                    level_2_performance.detection_confidence.quality_status
                                )}
                            >
                                <ThemedText
                                    style={[
                                        styles.value,
                                        {
                                            color:
                                                level_2_performance.detection_confidence.quality_status ===
                                                    "EXCELLENT" ||
                                                    level_2_performance.detection_confidence.quality_status ===
                                                    "GOOD"
                                                    ? "#4CAF50"
                                                    : level_2_performance.detection_confidence
                                                        .quality_status === "ACCEPTABLE"
                                                        ? "#FF9800"
                                                        : "#666",
                                        },
                                    ]}
                                >
                                    {level_2_performance.detection_confidence.sample_size > 0
                                        ? `${(level_2_performance.detection_confidence.average_confidence * 100).toFixed(1)}%`
                                        : "N/A"}
                                </ThemedText>
                                <ThemedText style={styles.subtitle}>
                                    Muestras: {level_2_performance.detection_confidence.sample_size}
                                </ThemedText>
                                <ThemedText style={styles.statusLabel}>
                                    {level_2_performance.detection_confidence.quality_status}
                                </ThemedText>
                            </KPICard>
                        </View>
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
                            Última actualización: {formatTimestamp(kpiData.metadata.generated_at)}
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
        borderColor: "#E0E0E0",
        backgroundColor: "#FFFFFF",
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
