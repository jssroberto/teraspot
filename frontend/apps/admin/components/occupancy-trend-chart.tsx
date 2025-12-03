import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Path, Line, Text as SvgText, Circle, Defs, LinearGradient, Stop, G } from "react-native-svg";
import { ThemedText } from "./themed-text";
import { OccupancyTrendDataPoint } from "@repo/core";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface OccupancyTrendChartProps {
    data: OccupancyTrendDataPoint[];
    height?: number;
}

export function OccupancyTrendChart({
    data,
    height = 220,
}: OccupancyTrendChartProps) {
    const [containerWidth, setContainerWidth] = useState(300);
    const colorScheme = useColorScheme();

    // Calculate chart dimensions with proper padding
    const padding = { left: 10, right: 35, top: 10, bottom: 30 };
    const chartWidth = Math.max(containerWidth - padding.left - padding.right, 100);
    const chartHeight = height - padding.top - padding.bottom;

    // Dark mode colors
    const isDark = colorScheme === 'dark';
    const gridColor = isDark ? '#333' : '#E0E0E0';
    const textColor = isDark ? '#888' : '#666';
    const lineColor = isDark ? '#00E5FF' : '#2196F3'; // Cyan accent for dark mode
    const fillColor = isDark ? 'rgba(0, 229, 255, 0.2)' : 'rgba(33, 150, 243, 0.1)';
    const pointStroke = isDark ? '#1E1E1E' : '#FFFFFF';

    if (!data || data.length === 0) {
        return (
            <View style={styles.container}>
                <ThemedText style={styles.noData}>No hay datos disponibles</ThemedText>
            </View>
        );
    }

    // Filter out data points with sample_size 0 for better visualization
    const validData = data.filter((d) => d.sample_size > 0);

    if (validData.length === 0) {
        return (
            <View style={styles.container}>
                <ThemedText style={styles.noData}>No hay datos disponibles</ThemedText>
            </View>
        );
    }

    const maxY = 100;
    const minY = 0;

    // Calculate points
    const points = validData.map((point, index) => {
        const x = (index / Math.max(validData.length - 1, 1)) * chartWidth;
        const y = chartHeight - ((point.occupancy_rate - minY) / (maxY - minY)) * chartHeight;
        return { x, y, data: point };
    });

    // Create path for line
    const pathData = points
        .map((point, index) => {
            if (index === 0) {
                return `M ${point.x} ${point.y}`;
            }
            return `L ${point.x} ${point.y}`;
        })
        .join(" ");

    // Create path for gradient fill
    const fillPathData =
        pathData +
        ` L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`;

    // Format hour from timestamp
    const formatHour = (timestamp: string) => {
        const date = new Date(timestamp);
        return date.getHours().toString().padStart(2, "0") + "h";
    };

    // Show fewer labels on small screens
    const labelStep = containerWidth < 400 ? 6 : 4;
    const labelIndices = points
        .map((_, i) => i)
        .filter((i) => i % labelStep === 0 || i === points.length - 1);

    return (
        <View
            style={styles.container}
            onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setContainerWidth(width);
            }}
        >
            <Svg width={containerWidth} height={height}>
                <Defs>
                    <LinearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                        <Stop offset="0" stopColor={lineColor} stopOpacity="0.3" />
                        <Stop offset="1" stopColor={lineColor} stopOpacity="0.05" />
                    </LinearGradient>
                </Defs>

                <G transform={`translate(${padding.left}, ${padding.top})`}>
                    {/* Grid lines */}
                    {[0, 25, 50, 75, 100].map((value) => {
                        const y = chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
                        return (
                            <Line
                                key={value}
                                x1={0}
                                y1={y}
                                x2={chartWidth}
                                y2={y}
                                stroke={gridColor}
                                strokeWidth={1}
                                strokeDasharray="4,4"
                                opacity={0.5}
                            />
                        );
                    })}

                    {/* Gradient fill */}
                    <Path
                        d={fillPathData}
                        fill="url(#chartGradient)"
                        stroke="none"
                    />

                    {/* Line */}
                    <Path
                        d={pathData}
                        fill="none"
                        stroke={lineColor}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {/* Data points */}
                    {points.filter((_, i) => i % 2 === 0).map((point, index) => (
                        <Circle
                            key={index}
                            cx={point.x}
                            cy={point.y}
                            r={3}
                            fill={lineColor}
                            stroke={pointStroke}
                            strokeWidth={1.5}
                        />
                    ))}

                    {/* X-axis labels */}
                    {labelIndices.map((index) => {
                        const point = points[index];
                        return (
                            <SvgText
                                key={index}
                                x={point.x}
                                y={chartHeight + 18}
                                fontSize={9}
                                fill={textColor}
                                textAnchor="middle"
                            >
                                {formatHour(point.data.timestamp)}
                            </SvgText>
                        );
                    })}

                    {/* Y-axis labels */}
                    {[0, 50, 100].map((value) => {
                        const y = chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
                        return (
                            <SvgText
                                key={value}
                                x={chartWidth + 5}
                                y={y + 3}
                                fontSize={9}
                                fill={textColor}
                                textAnchor="start"
                            >
                                {value}%
                            </SvgText>
                        );
                    })}
                </G>
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: '100%',
        alignItems: "center",
    },
    noData: {
        textAlign: "center",
        opacity: 0.5,
        paddingVertical: 40,
    },
});
