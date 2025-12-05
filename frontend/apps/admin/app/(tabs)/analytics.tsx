import { Colors } from '@/constants/theme';
import { useColorScheme } from '@/hooks/use-color-scheme';
import { getOccupancyTrend, getPeakHours, getPrediction } from '@repo/core';
import { Stack } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from 'react-native';
import Svg, { Circle, Line, Polyline, Rect, Text as SvgText } from 'react-native-svg';

// Simple custom chart components to avoid heavy dependencies
const LineChart = ({ data, prediction, width, height, color }) => {
    if (!data || data.length === 0) return null;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;

    const maxVal = 100;
    const minVal = 0;

    const points = data.map((d, i) => {
        const x = padding + (i / (data.length - 1)) * chartWidth;
        const y =
            height - padding - ((d.occupancy_rate - minVal) / (maxVal - minVal)) * chartHeight;
        return `${x},${y}`;
    });

    const predictionPoints = prediction
        ? prediction.map((d, i) => {
            const totalLen = data.length + prediction.length - 1;
            const index = data.length + i;
            const x = padding + (index / totalLen) * chartWidth;
            const y =
                height - padding - ((d.predicted_occupancy - minVal) / (maxVal - minVal)) * chartHeight;
            return `${x},${y}`;
        })
        : [];

    return (
        <Svg width={width} height={height}>
            {/* Background */}
            <Rect x={0} y={0} width={width} height={height} fill="#1A1A1A" />

            {/* Grid Lines */}
            {[0, 25, 50, 75, 100].map((val) => {
                const y = height - padding - (val / 100) * chartHeight;
                return (
                    <React.Fragment key={val}>
                        <Line
                            x1={padding}
                            y1={y}
                            x2={width - padding}
                            y2={y}
                            stroke="#333"
                            strokeWidth="1"
                            strokeDasharray={val === 50 ? "5, 5" : "2, 4"}
                        />
                        <SvgText x={padding - 8} y={y + 4} fill="#888" fontSize="10" textAnchor="end">
                            {val}%
                        </SvgText>
                    </React.Fragment>
                );
            })}

            {/* Axes */}
            <Line
                x1={padding}
                y1={padding}
                x2={padding}
                y2={height - padding}
                stroke="#555"
                strokeWidth="2"
            />
            <Line
                x1={padding}
                y1={height - padding}
                x2={width - padding}
                y2={height - padding}
                stroke="#555"
                strokeWidth="2"
            />

            {/* Historical Data Line */}
            <Polyline
                points={points.join(' ')}
                fill="none"
                stroke={color}
                strokeWidth="3"
            />

            {/* Historical Data Points */}
            {points.slice(0, Math.min(points.length, 24)).map((p, i) => {
                const [cx, cy] = p.split(',');
                return (
                    <React.Fragment key={i}>
                        <Circle cx={parseFloat(cx)} cy={parseFloat(cy)} r="4" fill={color} />
                    </React.Fragment>
                );
            })}

            {/* Prediction Line */}
            {predictionPoints.length > 0 && (
                <>
                    <Polyline
                        points={predictionPoints.map(p => p).join(' ')}
                        fill="none"
                        stroke="#FFD700"
                        strokeWidth="2"
                        strokeDasharray="5, 5"
                    />
                    {predictionPoints.map((p, i) => {
                        const [cx, cy] = p.split(',');
                        return <Circle key={i} cx={parseFloat(cx)} cy={parseFloat(cy)} r="3" fill="#FFD700" />;
                    })}
                </>
            )}

            {/* Axis Labels */}
            <SvgText
                x={padding / 2}
                y={height / 2}
                fill="#AAA"
                fontSize="12"
                textAnchor="middle"
                transform={`rotate(-90, ${padding / 2}, ${height / 2})`}
            >
                Occupancy %
            </SvgText>
            <SvgText x={width / 2} y={height - 5} fill="#AAA" fontSize="12" textAnchor="middle">
                Time
            </SvgText>
        </Svg>
    );
};

const BarChart = ({ data, width, height, color }) => {
    if (!data || data.length === 0) return null;

    const padding = 40;
    const chartWidth = width - padding * 2;
    const chartHeight = height - padding * 2;
    const maxVal = Math.max(...data.map(d => d.occupancy_percentage), 100);
    const barWidth = (chartWidth / data.length) * 0.7;
    const barGap = (chartWidth / data.length) * 0.3;

    return (
        <Svg width={width} height={height}>
            {/* Background */}
            <Rect x={0} y={0} width={width} height={height} fill="#1A1A1A" />

            {/* Grid Lines */}
            {[0, 25, 50, 75, 100].map((val) => {
                const y = height - padding - (val / maxVal) * chartHeight;
                return (
                    <Line
                        key={val}
                        x1={padding}
                        y1={y}
                        x2={width - padding}
                        y2={y}
                        stroke="#333"
                        strokeWidth="1"
                        strokeDasharray="2, 4"
                    />
                );
            })}

            {/* Axes */}
            <Line
                x1={padding}
                y1={height - padding}
                x2={width - padding}
                y2={height - padding}
                stroke="#555"
                strokeWidth="2"
            />

            {/* Bars */}
            {data.map((d, i) => {
                const barHeight = (d.occupancy_percentage / maxVal) * chartHeight;
                const x = padding + i * (chartWidth / data.length) + barGap / 2;
                const y = height - padding - barHeight;

                // Color intensity based on value
                const intensity = d.occupancy_percentage / 100;
                const barColor = `rgba(255, ${100 - intensity * 100}, ${100 - intensity * 100}, ${0.7 + intensity * 0.3})`;

                return (
                    <React.Fragment key={i}>
                        <Rect
                            x={x}
                            y={y}
                            width={barWidth}
                            height={barHeight}
                            fill={barColor}
                            rx="4"
                        />
                        <SvgText
                            x={x + barWidth / 2}
                            y={height - padding + 15}
                            fill="#AAA"
                            fontSize="10"
                            fontWeight="600"
                            textAnchor="middle">
                            {d.hour}:00
                        </SvgText>
                        {barHeight > 20 && (
                            <SvgText
                                x={x + barWidth / 2}
                                y={y - 5}
                                fill="#FFF"
                                fontSize="11"
                                fontWeight="bold"
                                textAnchor="middle">
                                {Math.round(d.occupancy_percentage)}%
                            </SvgText>
                        )}
                    </React.Fragment>
                );
            })}

            {/* Axis Labels */}
            <SvgText
                x={padding / 2}
                y={height / 2}
                fill="#AAA"
                fontSize="12"
                textAnchor="middle"
                transform={`rotate(-90, ${padding / 2}, ${height / 2})`}
            >
                Occupancy %
            </SvgText>
            <SvgText x={width / 2} y={height - 5} fill="#AAA" fontSize="12" textAnchor="middle">
                Hour of Day
            </SvgText>
        </Svg>
    );
};

export default function AnalyticsScreen() {
    const colorScheme = useColorScheme() ?? 'dark';
    const theme = Colors[colorScheme];
    const { width: windowWidth } = useWindowDimensions();
    const [loading, setLoading] = useState(true);

    const [trends, setTrends] = useState([]);
    const [predictions, setPredictions] = useState(null); // slope, intercept, points
    const [peakHours, setPeakHours] = useState([]);

    // Period Selector (Hours Back)
    const [period, setPeriod] = useState(24); // 24, 168 (7d), 720 (30d)
    const [horizon, setHorizon] = useState('24'); // Prediction Horizon

    // Calculate responsive chart width
    // On web with sidebar: windowWidth - sidebar(280px) - padding(60px)
    // On mobile: windowWidth - padding(60px)
    const chartWidth = windowWidth > 1024 ? windowWidth - 340 : windowWidth - 60;

    useEffect(() => {
        loadData();
    }, [period]); // Reload when period changes

    // Reload when horizon changes (debounced ideally, but onBlur/button is better, here simple effect for demo)
    // Actually, let's just make it reload on button or focus change. 
    // For simplicity, I'll add a "Refresh" button or just hook it to effect with debouncing?
    // I'll hook it to effect but with check.
    useEffect(() => {
        const timeout = setTimeout(() => {
            loadData();
        }, 500);
        return () => clearTimeout(timeout);
    }, [horizon]);

    const loadData = async () => {
        try {
            setLoading(true);

            const horizonHours = parseInt(horizon, 10) || 24;

            const [trendData, peakData, predData] = await Promise.all([
                getOccupancyTrend(period, period > 24 ? 240 : 60), // Coarser interval for longer periods
                getPeakHours(30), // Always analyze last 30 days for peak hours
                getPrediction(period, horizonHours) // Predict next 24h based on period
            ]);

            console.log('Trend data:', trendData);
            console.log('Peak data:', peakData);
            console.log('Prediction data:', predData);

            // Handle both response formats:
            // 1. Direct: {kpi: "name", data: {...}}
            // 2. Nested: {level_3_analytics: {occupancy_trend: {...}}}
            const trendResult = trendData?.level_3_analytics?.occupancy_trend || trendData?.data || trendData;
            const peakResult = peakData?.level_3_analytics?.peak_hours || peakData?.data || peakData;
            const predResult = predData?.data || predData;

            setTrends(trendResult.trend_data || []);
            setPeakHours(peakResult.peak_hours || []);
            setPredictions(predResult);

        } catch (error) {
            console.error('Failed to load analytics:', error);
            Alert.alert('Error', `Failed to load analytics data: ${error.message}`);
        } finally {
            setLoading(false);
        }
    };

    const styles = StyleSheet.create({
        container: {
            flex: 1,
            backgroundColor: theme.background,
        },
        scrollView: {
            padding: 20,
            paddingBottom: 40,
        },
        header: {
            marginBottom: 20,
        },
        title: {
            fontSize: 24,
            fontWeight: 'bold',
            color: theme.text,
            marginBottom: 5,
        },
        subtitle: {
            fontSize: 14,
            color: theme.icon,
        },
        card: {
            backgroundColor: '#1E1E1E',
            borderRadius: 12,
            padding: 16,
            marginBottom: 20,
            borderWidth: 1,
            borderColor: '#333',
        },
        cardTitle: {
            fontSize: 18,
            fontWeight: '600',
            color: theme.text,
            marginBottom: 15,
        },
        cardSubtitle: {
            fontSize: 12,
            color: '#AAA',
            marginBottom: 10,
        },
        filterRow: {
            flexDirection: 'row',
            marginBottom: 20,
            backgroundColor: '#333',
            borderRadius: 8,
            padding: 4,
        },
        filterButton: {
            flex: 1,
            paddingVertical: 8,
            alignItems: 'center',
            borderRadius: 6,
        },
        filterButtonActive: {
            backgroundColor: theme.tint,
        },
        filterText: {
            color: '#CCC',
            fontWeight: '600',
        },
        filterTextActive: {
            color: '#FFF',
        },
        statRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            marginBottom: 15,
        },
        statItem: {
            alignItems: 'center',
        },
        statValue: {
            fontSize: 20,
            fontWeight: 'bold',
            color: '#FFF',
        },
        statLabel: {
            fontSize: 12,
            color: '#AAA',
        },
        predictionBadge: {
            backgroundColor: predictions?.trend_direction === 'INCREASING' ? '#FF4444' : predictions?.trend_direction === 'DECREASING' ? '#44AA44' : '#888',
            paddingHorizontal: 8,
            paddingVertical: 4,
            borderRadius: 4,
            alignSelf: 'flex-start',
            marginBottom: 10
        },
        predictionText: {
            color: '#FFF',
            fontSize: 12,
            fontWeight: 'bold'
        },
        settingRow: {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 15,
            backgroundColor: '#1E1E1E',
            padding: 12,
            borderRadius: 8,
            borderWidth: 1,
            borderColor: '#333'
        },
        settingLabel: {
            color: '#CCC',
            fontSize: 14
        },
        settingInput: {
            backgroundColor: '#2C2C2C',
            color: '#FFF',
            borderRadius: 6,
            padding: 8,
            width: 60,
            textAlign: 'center',
            fontWeight: 'bold'
        },
        cardHeaderRow: {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: 10
        },
        legend: {
            flexDirection: 'row',
            gap: 12
        },
        legendItem: {
            flexDirection: 'row',
            alignItems: 'center',
            gap: 6
        },
        legendDot: {
            width: 10,
            height: 10,
            borderRadius: 5
        },
        legendText: {
            color: '#CCC',
            fontSize: 12
        }
    });

    return (
        <>
            <Stack.Screen options={{ title: 'Analytics', headerShown: true }} />
            <ScrollView style={styles.container} contentContainerStyle={styles.scrollView}>
                <View style={styles.header}>
                    <Text style={styles.title}>Inference & Analytics</Text>
                    <Text style={styles.subtitle}>Historical analysis and future predictions</Text>
                </View>

                {/* Prediction Config */}
                <View style={styles.settingRow}>
                    <Text style={styles.settingLabel}>Prediction Horizon (Hours):</Text>
                    <TextInput
                        style={styles.settingInput}
                        value={horizon}
                        onChangeText={setHorizon}
                        keyboardType="numeric"
                        maxLength={3}
                    />
                </View>

                {/* Period Selector */}
                <View style={styles.filterRow}>
                    {[
                        { label: '24 Hours', value: 24 },
                        { label: '7 Days', value: 168 },
                        { label: '30 Days', value: 720 },
                    ].map((item) => (
                        <TouchableOpacity
                            key={item.value}
                            style={[
                                styles.filterButton,
                                period === item.value && styles.filterButtonActive,
                            ]}
                            onPress={() => setPeriod(item.value)}>
                            <Text
                                style={[
                                    styles.filterText,
                                    period === item.value && styles.filterTextActive,
                                ]}>
                                {item.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>

                {loading ? (
                    <ActivityIndicator size="large" color={theme.tint} style={{ marginTop: 20 }} />
                ) : (
                    <>
                        {/* Occupancy Trend & Prediction */}
                        <View style={styles.card}>
                            <View style={styles.cardHeaderRow}>
                                <View>
                                    <Text style={styles.cardTitle}>Occupancy Trend & Prediction</Text>
                                    {predictions && (
                                        <View style={styles.predictionBadge}>
                                            <Text style={styles.predictionText}>Trend: {predictions.trend_direction}</Text>
                                        </View>
                                    )}
                                </View>
                                <View style={styles.legend}>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: theme.tint }]} />
                                        <Text style={styles.legendText}>Historical</Text>
                                    </View>
                                    <View style={styles.legendItem}>
                                        <View style={[styles.legendDot, { backgroundColor: '#FFD700' }]} />
                                        <Text style={styles.legendText}>Predicted</Text>
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.cardSubtitle}>
                                Slope: {predictions?.slope?.toFixed(4) ?? 'N/A'}.
                                Showing forecast for next {parseInt(horizon) || 24} hours.
                            </Text>

                            <LineChart
                                data={trends}
                                prediction={predictions?.predictions}
                                width={chartWidth}
                                height={250}
                                color={theme.tint}
                            />
                        </View>

                        {/* Peak Hours Clustering */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Peak Hours Analysis</Text>
                            <Text style={styles.cardSubtitle}>
                                Top 5 busiest hours based on {period / 24} days of data.
                                Darker red = higher occupancy.
                            </Text>
                            <BarChart
                                data={peakHours}
                                width={chartWidth}
                                height={250}
                                color="#FF6B6B"
                            />
                        </View>

                        {/* Stats Summary */}
                        <View style={styles.card}>
                            <Text style={styles.cardTitle}>Summary Statistics</Text>
                            <View style={styles.statRow}>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{trends.length}</Text>
                                    <Text style={styles.statLabel}>Data Points</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{period / 24} Days</Text>
                                    <Text style={styles.statLabel}>Analyzed</Text>
                                </View>
                                <View style={styles.statItem}>
                                    <Text style={styles.statValue}>{peakHours.length > 0 ? peakHours[0].hour + ':00' : 'N/A'}</Text>
                                    <Text style={styles.statLabel}>Peak Hour</Text>
                                </View>
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </>
    );
}
