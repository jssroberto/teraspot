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
        padding: 24,
        borderRadius: 16,
        marginBottom: 20,
        borderWidth: 1,
        borderColor: "rgba(255,255,255,0.1)", // Subtle border for dark mode
        backgroundColor: "#1E1E1E", // Darker premium background
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    title: {
        fontSize: 13,
        fontWeight: "700",
        marginBottom: 16,
        opacity: 0.5,
        letterSpacing: 1.5,
        textTransform: "uppercase",
        color: "#E0E0E0",
    },
    value: {
        fontSize: 36,
        fontWeight: "800",
        marginBottom: 8,
        letterSpacing: -1,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.5,
        color: "#B0B0B0",
        fontWeight: "500",
    },
});
