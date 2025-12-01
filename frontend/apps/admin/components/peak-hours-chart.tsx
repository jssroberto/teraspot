import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Svg, { Rect, Line, Text as SvgText } from "react-native-svg";
import { ThemedText } from "./themed-text";

interface PeakHoursChartProps {
    hourlyBreakdown: Record<string, number>;
    height?: number;
}

export function PeakHoursChart({
    hourlyBreakdown,
    height = 200,
}: PeakHoursChartProps) {
    const screenWidth = Dimensions.get("window").width;
    const chartWidth = screenWidth - 60;
    const chartHeight = height - 40;

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
        if (value >= 90) return "#F44336"; // Red
        if (value >= 60) return "#FF9800"; // Orange/Yellow
        return "#4CAF50"; // Green
    };

    return (
        <View style={styles.container}>
            <Svg width={chartWidth} height={height}>
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((value) => {
                    const y = chartHeight - (value / maxValue) * chartHeight;
                    return (
                        <Line
                            key={value}
                            x1={0}
                            y1={y}
                            x2={chartWidth}
                            y2={y}
                            stroke="#E0E0E0"
                            strokeWidth={1}
                            strokeDasharray="4,4"
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
                            x={x + barWidth * 0.1}
                            y={y}
                            width={barWidth * 0.8}
                            height={barHeight}
                            fill={getBarColor(value)}
                            opacity={0.8}
                        />
                    );
                })}

                {/* X-axis labels (show every 3 hours) */}
                {hours
                    .filter((_, i) => i % 3 === 0)
                    .map((hour, index) => {
                        const actualIndex = parseInt(hour);
                        const x = actualIndex * barWidth + barWidth / 2;
                        return (
                            <SvgText
                                key={hour}
                                x={x}
                                y={chartHeight + 20}
                                fontSize={10}
                                fill="#666"
                                textAnchor="middle"
                            >
                                {hour}h
                            </SvgText>
                        );
                    })}
            </Svg>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingVertical: 10,
        alignItems: "center",
    },
    noData: {
        textAlign: "center",
        opacity: 0.5,
        paddingVertical: 40,
    },
});
