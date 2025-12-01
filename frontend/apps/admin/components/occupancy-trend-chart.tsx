import React from "react";
import { StyleSheet, View, Dimensions } from "react-native";
import Svg, { Path, Line, Text as SvgText, Circle } from "react-native-svg";
import { ThemedText } from "./themed-text";
import { OccupancyTrendDataPoint } from "@repo/core";

interface OccupancyTrendChartProps {
    data: OccupancyTrendDataPoint[];
    height?: number;
}

export function OccupancyTrendChart({
    data,
    height = 250,
}: OccupancyTrendChartProps) {
    const screenWidth = Dimensions.get("window").width;
    const chartWidth = screenWidth - 60; // Account for padding
    const chartHeight = height - 60; // Account for labels

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
        const x = (index / (validData.length - 1)) * chartWidth;
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

    // Show every 4th hour label to avoid crowding
    const labelIndices = points
        .map((_, i) => i)
        .filter((i) => i % 4 === 0 || i === points.length - 1);

    return (
        <View style={styles.container}>
            <Svg width={chartWidth + 40} height={height}>
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
                            stroke="#E0E0E0"
                            strokeWidth={1}
                            strokeDasharray="4,4"
                        />
                    );
                })}

                {/* Gradient fill */}
                <Path
                    d={fillPathData}
                    fill="rgba(33, 150, 243, 0.1)"
                    stroke="none"
                />

                {/* Line */}
                <Path
                    d={pathData}
                    fill="none"
                    stroke="#2196F3"
                    strokeWidth={3}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                />

                {/* Data points */}
                {points.map((point, index) => (
                    <Circle
                        key={index}
                        cx={point.x}
                        cy={point.y}
                        r={4}
                        fill="#2196F3"
                        stroke="#FFFFFF"
                        strokeWidth={2}
                    />
                ))}

                {/* X-axis labels */}
                {labelIndices.map((index) => {
                    const point = points[index];
                    return (
                        <SvgText
                            key={index}
                            x={point.x}
                            y={chartHeight + 20}
                            fontSize={10}
                            fill="#666"
                            textAnchor="middle"
                        >
                            {formatHour(point.data.timestamp)}
                        </SvgText>
                    );
                })}

                {/* Y-axis labels */}
                {[0, 25, 50, 75, 100].map((value) => {
                    const y = chartHeight - ((value - minY) / (maxY - minY)) * chartHeight;
                    return (
                        <SvgText
                            key={value}
                            x={chartWidth + 15}
                            y={y + 4}
                            fontSize={10}
                            fill="#666"
                            textAnchor="start"
                        >
                            {value}%
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
