import AsyncStorage from "@react-native-async-storage/async-storage";
import { cognitoUserPoolsTokenProvider } from "aws-amplify/auth/cognito";
import "react-native-get-random-values";
import "react-native-url-polyfill/auto";

// Configure Amplify Storage
cognitoUserPoolsTokenProvider.setKeyValueStorage(AsyncStorage);

import { WebSidebar } from "@/components/WebSidebar";
import { WebNavBar } from "@/components/web-navbar";
import "@aws-amplify/react-native"; // Essential for Amplify v6 on RN
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider,
} from "@react-navigation/native";
import { Amplify } from "aws-amplify";
import { getCurrentUser } from "aws-amplify/auth";
import { Hub } from "aws-amplify/utils";
import { Stack, useRouter, useSegments } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useEffect, useState } from "react";
import { View, useWindowDimensions } from "react-native";
import "react-native-reanimated";

import { useColorScheme } from "@/hooks/use-color-scheme";

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: "us-east-1_d5t7fc1oH",
      userPoolClientId: "16q6v4ctsfcs942bvcmpp056c6",
    },
  },
});

export const unstable_settings = {
  anchor: "(tabs)",
};

export default function RootLayout() {
  const colorScheme = useColorScheme();
  const [user, setUser] = useState<any>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const segments = useSegments();
  const router = useRouter();

  // Check user status
  useEffect(() => {
    console.log("RootLayout mounted");
    checkUser();

    // Listen for auth events
    const listener = Hub.listen("auth", (data) => {
      console.log("Auth event:", data.payload.event);
      if (data.payload.event === "signedIn") checkUser();
      if (data.payload.event === "signedOut") setUser(null);
    });

    return () => listener();
  }, []);

  const checkUser = async () => {
    try {
      console.log("Checking current user...");
      const u = await getCurrentUser();
      console.log("User found:", u.username);
      setUser(u);
    } catch (e) {
      console.log("Error checking user:", e);
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  };

  // Protect routes
  useEffect(() => {
    console.log("Protection check:", {
      isLoaded,
      user: !!user,
      segment: segments[0],
    });
    if (!isLoaded) return;

    const inLoginGroup = (segments[0] as string) === "login";

    if (!user && !inLoginGroup) {
      console.log("Redirecting to login...");
      // Redirect to login if not authenticated
      router.replace("/login" as any);
    } else if (user && inLoginGroup) {
      console.log("Redirecting to tabs...");
      // Redirect to tabs if authenticated and trying to access login
      router.replace("/(tabs)");
    }
  }, [user, segments, isLoaded, router]);

  const { width } = useWindowDimensions();
  const isLargeScreen = width >= 768; // Standard tablet/desktop breakpoint

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <View style={{ flex: 1, flexDirection: "row" }}>
        {isLargeScreen && user && <WebSidebar />}
        <View style={{ flex: 1 }}>
          {!isLargeScreen && user && <WebNavBar />}
          <Stack>
            <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
            <Stack.Screen name="login" options={{ headerShown: false }} />
            <Stack.Screen
              name="modal"
              options={{ presentation: "modal", title: "Modal" }}
            />
          </Stack>
        </View>
      </View>
      <StatusBar style="auto" />
    </ThemeProvider>
  );
}
