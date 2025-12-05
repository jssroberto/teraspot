import { Colors } from "@/constants/theme";
import { useColorScheme } from "@/hooks/use-color-scheme";
import { usePathname, useRouter } from "expo-router";
import React, { useState } from "react";
import {
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import { IconSymbol } from "./ui/icon-symbol";

interface NavItem {
  name: string;
  title: string;
  icon: string;
  path: string;
}

const navItems: NavItem[] = [
  {
    name: "dashboard",
    title: "Dashboard",
    icon: "chart.bar.fill",
    path: "/(tabs)/dashboard",
  },
  {
    name: "cameras",
    title: "Cameras",
    icon: "video.fill",
    path: "/cameras",
  },
  {
    name: "alerts",
    title: "Alerts",
    icon: "bell.fill",
    path: "/(tabs)/alerts",
  },
  {
    name: "analytics",
    title: "Analytics",
    icon: "chart.line.uptrend.xyaxis",
    path: "/(tabs)/analytics",
  },
];

export function WebNavBar() {
  const router = useRouter();
  const pathname = usePathname();
  const colorScheme = useColorScheme();
  const { width: windowWidth } = useWindowDimensions();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const colors = Colors[colorScheme ?? "light"];
  const isDesktop = windowWidth >= 768;

  // Determine current active tab
  const getCurrentTab = () => {
    if (pathname.includes("dashboard")) return "dashboard";
    if (pathname.includes("cameras")) return "cameras";
    if (pathname.includes("alerts")) return "alerts";
    if (pathname.includes("analytics")) return "analytics";
    return "dashboard"; // Default to dashboard if nothing matches
  };

  const currentTab = getCurrentTab();
  const currentNavItem = navItems.find((item) => item.name === currentTab);

  const handleNavigation = (path: string) => {
    router.push(path as any);
    setMobileMenuOpen(false);
  };

  // Only render on web
  if (Platform.OS !== "web") {
    return null;
  }

  return (
    <View
      style={[
        styles.navbar,
        {
          backgroundColor: colors.background,
          borderBottomColor: colorScheme === "dark" ? "#333" : "#E0E0E0",
        },
      ]}
    >
      <View style={styles.navContent}>
        {/* Logo/Brand */}
        <View style={styles.brand}>
          <IconSymbol name="bolt.fill" size={24} color={colors.tint} />
          <Text style={[styles.brandText, { color: colors.text }]}>
            TeraSpot Admin
          </Text>
        </View>

        {/* Desktop Navigation - Visible on desktop */}
        {isDesktop ? (
          <View style={styles.desktopNav}>
            {navItems.map((item) => (
              <TouchableOpacity
                key={item.name}
                style={[
                  styles.navItem,
                  currentTab === item.name && {
                    borderBottomColor: colors.tint,
                    borderBottomWidth: 3,
                  },
                ]}
                onPress={() => handleNavigation(item.path)}
              >
                <IconSymbol
                  name={item.icon as any}
                  size={20}
                  color={currentTab === item.name ? colors.tint : colors.icon}
                />
                <Text
                  style={[
                    styles.navItemText,
                    {
                      color:
                        currentTab === item.name ? colors.tint : colors.text,
                    },
                  ]}
                >
                  {item.title}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          /* Mobile Dropdown - Visible on mobile */
          <View style={styles.mobileNav}>
            <Pressable
              style={[
                styles.dropdownButton,
                {
                  backgroundColor: colorScheme === "dark" ? "#333" : "#F5F5F5",
                },
              ]}
              onPress={() => setMobileMenuOpen(!mobileMenuOpen)}
            >
              <IconSymbol
                name={currentNavItem?.icon as any}
                size={20}
                color={colors.tint}
              />
              <Text style={[styles.dropdownButtonText, { color: colors.text }]}>
                {currentNavItem?.title}
              </Text>
              <IconSymbol
                name={mobileMenuOpen ? "chevron.up" : "chevron.down"}
                size={16}
                color={colors.icon}
              />
            </Pressable>

            {/* Mobile Dropdown Menu */}
            {mobileMenuOpen && (
              <View
                style={[
                  styles.dropdownMenu,
                  {
                    backgroundColor: colors.background,
                    borderColor: colorScheme === "dark" ? "#333" : "#E0E0E0",
                  },
                ]}
              >
                {navItems.map((item) => (
                  <Pressable
                    key={item.name}
                    style={[
                      styles.dropdownItem,
                      currentTab === item.name && {
                        backgroundColor:
                          colorScheme === "dark" ? "#2A2A2A" : "#F0F0F0",
                      },
                    ]}
                    onPress={() => handleNavigation(item.path)}
                  >
                    <IconSymbol
                      name={item.icon as any}
                      size={20}
                      color={
                        currentTab === item.name ? colors.tint : colors.icon
                      }
                    />
                    <Text
                      style={[
                        styles.dropdownItemText,
                        {
                          color:
                            currentTab === item.name
                              ? colors.tint
                              : colors.text,
                        },
                      ]}
                    >
                      {item.title}
                    </Text>
                    {currentTab === item.name && (
                      <IconSymbol
                        name="checkmark"
                        size={16}
                        color={colors.tint}
                      />
                    )}
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Right side actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol name="bell.fill" size={20} color={colors.icon} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButton}>
            <IconSymbol
              name="person.circle.fill"
              size={24}
              color={colors.icon}
            />
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  navbar: {
    height: 64,
    borderBottomWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    zIndex: 1000,
  },
  navContent: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    height: "100%",
    paddingHorizontal: 20,
    maxWidth: 1600,
    marginHorizontal: "auto",
    width: "100%",
  },
  brand: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandText: {
    fontSize: 18,
    fontWeight: "600",
  },
  desktopNav: {
    flexDirection: "row",
    gap: 8,
    flex: 1,
    justifyContent: "center",
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    height: 48,
  },
  navItemText: {
    fontSize: 15,
    fontWeight: "500",
  },
  mobileNav: {
    position: "relative",
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  dropdownButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    minWidth: 180,
  },
  dropdownButtonText: {
    fontSize: 15,
    fontWeight: "500",
    flex: 1,
  },
  dropdownMenu: {
    position: "absolute",
    top: 50,
    left: "50%",
    transform: [{ translateX: -90 }] as any,
    minWidth: 200,
    borderRadius: 8,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 5,
    overflow: "hidden",
  },
  dropdownItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  dropdownItemText: {
    fontSize: 15,
    flex: 1,
  },
  actions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  actionButton: {
    padding: 8,
  },
});
