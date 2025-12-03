import React, { useEffect, useRef } from "react";
import { StyleSheet, View, Animated } from "react-native";
import Svg, { Circle, G } from "react-native-svg";
import { ThemedText } from "./themed-text";

interface OccupancyGaugeProps {
    percentage: number;
    status: "OPTIMAL" | "WARNING" | "CRITICAL";
    size?: number;
}

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

export function OccupancyGauge({
    percentage,
    status,
    size = 180,
}: OccupancyGaugeProps) {
    const animatedValue = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(animatedValue, {
            toValue: percentage,
            duration: 1000,
            useNativeDriver: true,
        }).start();
    }, [percentage]);

    const getStatusColor = () => {
        switch (status) {
            case "OPTIMAL":
                return "#4CAF50";
            case "WARNING":
                return "#FF9800";
            case "CRITICAL":
                return "#F44336";
            default:
                return "#2196F3";
        }
    };

    const getStatusLabel = () => {
        switch (status) {
            case "OPTIMAL":
                return "ÓPTIMAL";
            case "WARNING":
                return "ADVERTENCIA";
            case "CRITICAL":
                return "CRÍTICO";
            default:
                return "";
        }
    };

    const strokeWidth = 12;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const strokeDashoffset = circumference - (percentage / 100) * circumference;

    return (
        <View style={styles.container}>
            <Svg width={size} height={size}>
                <G rotation="-90" origin={`${size / 2}, ${size / 2}`}>
                    {/* Background circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke="#333" // Darker background track
                        strokeWidth={strokeWidth}
                        fill="none"
                        opacity={0.3}
                    />
                    {/* Progress circle */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={getStatusColor()}
                        strokeWidth={strokeWidth}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                    // Add shadow/glow effect (supported in some SVG libs, but simple opacity layer works too)
                    />
                    {/* Glow effect (simulated with another circle) */}
                    <Circle
                        cx={size / 2}
                        cy={size / 2}
                        r={radius}
                        stroke={getStatusColor()}
                        strokeWidth={strokeWidth + 4}
                        fill="none"
                        strokeDasharray={circumference}
                        strokeDashoffset={strokeDashoffset}
                        strokeLinecap="round"
                        opacity={0.2}
                    />
                </G>
            </Svg>
            <View style={styles.textContainer}>
                <ThemedText style={styles.percentage}>
                    {percentage.toFixed(1)}%
                </ThemedText>
                <ThemedText style={[styles.status, { color: getStatusColor() }]}>
                    {getStatusLabel()}
                </ThemedText>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        alignItems: "center",
        justifyContent: "center",
    },
    textContainer: {
        position: "absolute",
        alignItems: "center",
    },
    percentage: {
        fontSize: 36,
        fontWeight: "bold",
    },
    status: {
        fontSize: 12,
        fontWeight: "600",
        marginTop: 4,
    },
});
