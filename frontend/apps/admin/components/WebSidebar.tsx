import { Link, usePathname } from "expo-router";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View, useWindowDimensions, TouchableOpacity, ScrollView } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { getParkingStatus, ParkingStatus } from "@repo/core";

export function WebSidebar() {
    const pathname = usePathname();
    const insets = useSafeAreaInsets();
    const { height } = useWindowDimensions();

    const [facilities, setFacilities] = useState<string[]>([]);
    const [selectedFacility, setSelectedFacility] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const [dropdownOpen, setDropdownOpen] = useState(false);

    useEffect(() => {
        fetchFacilities();
    }, []);

    const fetchFacilities = async () => {
        try {
            const status = await getParkingStatus();
            // Extract unique facility IDs
            const uniqueFacilities = Array.from(new Set(status.map(s => s.facility_id).filter(Boolean))) as string[];

            if (uniqueFacilities.length > 0) {
                setFacilities(uniqueFacilities);
                setSelectedFacility(uniqueFacilities[0]);
            } else {
                // Fallback if no facilities found
                setFacilities(["Main Lot"]);
                setSelectedFacility("Main Lot");
            }
        } catch (e) {
            console.error("Failed to fetch facilities", e);
            setFacilities(["Main Lot"]);
            setSelectedFacility("Main Lot");
        } finally {
            setLoading(false);
        }
    };

    const menuItems = [
        { name: "Dashboard", path: "/dashboard" },
        { name: "Cameras", path: "/cameras" },
        { name: "Analytics", path: "/analytics" }, // Placeholder
        { name: "Settings", path: "/settings" },   // Placeholder
    ];

    return (
        <View style={[styles.sidebar, { paddingTop: insets.top + 20, height }]}>
            <View style={styles.logoContainer}>
                <Text style={styles.logoText}>TeraSpot</Text>
                <Text style={styles.versionText}>ADMIN CONSOLE</Text>
            </View>

            <View style={styles.selectorContainer}>
                <Text style={styles.selectorLabel}>PARKING LOT</Text>
                <TouchableOpacity
                    style={styles.dropdownTrigger}
                    onPress={() => setDropdownOpen(!dropdownOpen)}
                >
                    <Text style={styles.dropdownText}>{selectedFacility || "Select Lot..."}</Text>
                    <Text style={styles.dropdownIcon}>▼</Text>
                </TouchableOpacity>

                {dropdownOpen && (
                    <View style={styles.dropdownMenu}>
                        {facilities.map(fac => (
                            <TouchableOpacity
                                key={fac}
                                style={styles.dropdownItem}
                                onPress={() => {
                                    setSelectedFacility(fac);
                                    setDropdownOpen(false);
                                }}
                            >
                                <Text style={[styles.dropdownItemText, selectedFacility === fac && styles.dropdownItemTextActive]}>
                                    {fac}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
            </View>

            <ScrollView style={styles.menuContainer}>
                <Text style={styles.sectionTitle}>MENU</Text>
                {menuItems.map((item) => {
                    // Simple active check - can be improved
                    const isActive = pathname === item.path || (item.path !== "/" && pathname.startsWith(item.path));

                    return (
                        <Link key={item.path} href={item.path as any} asChild>
                            <TouchableOpacity style={StyleSheet.flatten([styles.menuItem, isActive && styles.menuItemActive, styles.link])}>
                                <Text style={[styles.menuIcon, isActive && styles.menuIconActive]}>
                                    {item.name === "Dashboard" ? "📊" : item.name === "Cameras" ? "📹" : item.name === "Analytics" ? "📈" : "⚙️"}
                                </Text>
                                <Text style={[styles.menuText, isActive && styles.menuTextActive]}>
                                    {item.name}
                                </Text>
                            </TouchableOpacity>
                        </Link>
                    );
                })}
            </ScrollView>

            <View style={styles.footer}>
                <View style={styles.userProfile}>
                    <View style={styles.avatar}>
                        <Text style={styles.avatarText}>A</Text>
                    </View>
                    <View>
                        <Text style={styles.userName}>Admin User</Text>
                        <Text style={styles.userRole}>Super Admin</Text>
                    </View>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    sidebar: {
        width: 280,
        backgroundColor: "#121212", // Darker background
        borderRightWidth: 1,
        borderRightColor: "#2A2A2A",
        display: "flex",
        flexDirection: "column",
    },
    logoContainer: {
        paddingHorizontal: 24,
        marginBottom: 30,
    },
    logoText: {
        color: "#fff",
        fontSize: 26,
        fontWeight: "800",
        letterSpacing: -0.5,
    },
    versionText: {
        color: "#666",
        fontSize: 10,
        fontWeight: "600",
        letterSpacing: 1,
        marginTop: 4,
    },
    selectorContainer: {
        paddingHorizontal: 24,
        marginBottom: 30,
        zIndex: 100, // Ensure dropdown floats above
    },
    selectorLabel: {
        color: "#666",
        fontSize: 11,
        fontWeight: "600",
        marginBottom: 8,
        letterSpacing: 0.5,
    },
    dropdownTrigger: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        backgroundColor: "#1E1E1E",
        padding: 12,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#333",
    },
    dropdownText: {
        color: "#fff",
        fontWeight: "500",
    },
    dropdownIcon: {
        color: "#666",
        fontSize: 10,
    },
    dropdownMenu: {
        position: "absolute",
        top: 65,
        left: 24,
        right: 24,
        backgroundColor: "#252525",
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#333",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 5,
    },
    dropdownItem: {
        padding: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#333",
    },
    dropdownItemText: {
        color: "#aaa",
    },
    dropdownItemTextActive: {
        color: "#2196F3",
        fontWeight: "600",
    },
    menuContainer: {
        flex: 1,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        color: "#444",
        fontSize: 11,
        fontWeight: "700",
        marginLeft: 12,
        marginBottom: 10,
        letterSpacing: 1,
    },
    link: {
        marginBottom: 4,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    menuItemActive: {
        backgroundColor: "rgba(33, 150, 243, 0.1)", // Light blue tint
    },
    menuIcon: {
        marginRight: 12,
        fontSize: 16,
        opacity: 0.7,
    },
    menuIconActive: {
        opacity: 1,
    },
    menuText: {
        color: "#888",
        fontSize: 15,
        fontWeight: "500",
    },
    menuTextActive: {
        color: "#2196F3",
        fontWeight: "600",
    },
    footer: {
        padding: 20,
        borderTopWidth: 1,
        borderTopColor: "#2A2A2A",
        backgroundColor: "#161616",
    },
    userProfile: {
        flexDirection: "row",
        alignItems: "center",
    },
    avatar: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: "#333",
        alignItems: "center",
        justifyContent: "center",
        marginRight: 12,
    },
    avatarText: {
        color: "#fff",
        fontWeight: "600",
    },
    userName: {
        color: "#fff",
        fontSize: 14,
        fontWeight: "500",
    },
    userRole: {
        color: "#666",
        fontSize: 11,
    },
});
