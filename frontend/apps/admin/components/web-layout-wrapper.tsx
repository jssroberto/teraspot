import React from "react";
import { View, StyleSheet, Platform } from "react-native";
import { WebNavBar } from "./web-navbar";

interface WebLayoutWrapperProps {
    children: React.ReactNode;
}

/**
 * Wrapper component that adds the web navigation bar on web platform
 * and passes through children unchanged on mobile platforms
 */
export function WebLayoutWrapper({ children }: WebLayoutWrapperProps) {
    // On mobile, just return children without wrapper
    if (Platform.OS !== "web") {
        return <>{children}</>;
    }

    // On web, add the navbar
    return (
        <View style={styles.container}>
            <WebNavBar />
            <View style={styles.content}>{children}</View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        flex: 1,
    },
});
