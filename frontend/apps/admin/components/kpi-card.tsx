import React from "react";
import { StyleSheet, View } from "react-native";
import { ThemedText } from "./themed-text";
import { ThemedView } from "./themed-view";
import { useColorScheme } from "@/hooks/use-color-scheme";

interface KPICardProps {
    title: string;
    value?: string | number;
    subtitle?: string;
    status?: "success" | "warning" | "error" | "info";
    children?: React.ReactNode;
}

export function KPICard({
    title,
    value,
    subtitle,
    status,
    children,
}: KPICardProps) {
    const colorScheme = useColorScheme();

    const getStatusColor = () => {
        switch (status) {
            case "success":
                return "#4CAF50";
            case "warning":
                return "#FF9800";
            case "error":
                return "#F44336";
            case "info":
                return "#2196F3";
            default:
                return colorScheme === "dark" ? "#9BA1A6" : "#687076";
        }
    };

    return (
        <ThemedView style={styles.card}>
            <ThemedText style={styles.title}>{title}</ThemedText>
            {children || (
                <>
                    <ThemedText style={[styles.value, { color: getStatusColor() }]}>
                        {value}
                    </ThemedText>
                    {subtitle && (
                        <ThemedText style={styles.subtitle}>{subtitle}</ThemedText>
                    )}
                </>
            )}
        </ThemedView>
    );
}

const styles = StyleSheet.create({
    card: {
        flex: 1,
        padding: 24,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "rgba(0,0,0,0.1)", // Subtle border that works in both modes
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 16,
        opacity: 0.6,
        letterSpacing: 1.5,
        textTransform: "uppercase",
    },
    value: {
        fontSize: 36,
        fontWeight: "800",
        marginBottom: 8,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.6,
        fontWeight: "500",
    },
});
