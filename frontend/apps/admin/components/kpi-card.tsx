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
        padding: 20,
        borderRadius: 12,
        marginBottom: 15,
        borderWidth: 1,
        borderColor: "#E0E0E0",
        backgroundColor: "#FFFFFF",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    title: {
        fontSize: 14,
        fontWeight: "600",
        marginBottom: 12,
        opacity: 0.7,
        textTransform: "uppercase",
    },
    value: {
        fontSize: 32,
        fontWeight: "bold",
        marginBottom: 4,
    },
    subtitle: {
        fontSize: 14,
        opacity: 0.6,
    },
});
