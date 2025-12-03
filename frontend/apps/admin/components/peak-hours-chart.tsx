import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import Svg, { Rect, Line, Text as SvgText, G } from "react-native-svg";
import { ThemedText } from "./themed-text";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface PeakHoursChartProps {
    hourlyBreakdown: Record<string, number>;
    height?: number;
}

export function PeakHoursChart({
    hourlyBreakdown,
    height = 200,
}: PeakHoursChartProps) {
    const [containerWidth, setContainerWidth] = useState(300);
    const colorScheme = useColorScheme();

    // Calculate chart dimensions with proper padding
    const padding = { left: 10, right: 10, top: 10, bottom: 30 };
    const chartWidth = Math.max(containerWidth - padding.left - padding.right, 100);
    const chartHeight = height - padding.top - padding.bottom;

    // Dark mode colors
    const isDark = colorScheme === 'dark';
    const gridColor = isDark ? '#333' : '#E0E0E0';
    const textColor = isDark ? '#999' : '#666';

    if (!hourlyBreakdown || Object.keys(hourlyBreakdown).length === 0) {
        return (
            <View style={styles.container}>
                <ThemedText style={styles.noData}>No hay datos disponibles</ThemedText>
            </View>
        );
    }

    const hours = Array.from({ length: 24 }, (_, i) => i.toString());
    const barWidth = chartWidth / hours.length;
    const maxValue = 100;

    const getBarColor = (value: number) => {
        if (isDark) {
            // Dark mode colors - Neon/Vibrant
            if (value >= 90) return "#FF5252"; // Red accent
            if (value >= 60) return "#FFAB40"; // Amber accent
            return "#69F0AE"; // Green accent
        } else {
            // Light mode colors
            if (value >= 90) return "#F44336"; // Red
            if (value >= 60) return "#FF9800"; // Orange
            return "#4CAF50"; // Green
        }
    };

    return (
        <View
            style={styles.container}
            onLayout={(event) => {
                const { width } = event.nativeEvent.layout;
                setContainerWidth(width);
            }}
        >
            <Svg width={containerWidth} height={height}>
                <G transform={`translate(${padding.left}, ${padding.top})`}>
                    {/* Grid lines - only show 3 lines to reduce clutter */}
                    {[0, 50, 100].map((value) => {
                        const y = chartHeight - (value / maxValue) * chartHeight;
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

                    {/* Bars */}
                    {hours.map((hour, index) => {
                        const value = hourlyBreakdown[hour] || 0;
                        const barHeight = (value / maxValue) * chartHeight;
                        const x = index * barWidth;
                        const y = chartHeight - barHeight;

                        return (
                            <Rect
                                key={hour}
                                x={x + barWidth * 0.15}
                                y={y}
                                width={barWidth * 0.7}
                                height={Math.max(barHeight, 0)}
                                fill={getBarColor(value)}
                                opacity={0.85}
                                rx={1}
                            />
                        );
                    })}

                    {/* X-axis labels (show every 3 hours) */}
                    {hours
                        .filter((_, i) => i % 3 === 0)
                        .map((hour) => {
                            const actualIndex = parseInt(hour);
                            const x = actualIndex * barWidth + barWidth / 2;
                            return (
                                <SvgText
                                    key={hour}
                                    x={x}
                                    y={chartHeight + 18}
                                    fontSize={9}
                                    fill={textColor}
                                    textAnchor="middle"
                                >
                                    {hour}h
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
