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
import "react-native-reanimated";

import { WebLayoutWrapper } from "@/components/web-layout-wrapper";
import { useColorScheme } from "@/hooks/use-color-scheme";

// Configure Amplify
Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: process.env.EXPO_PUBLIC_COGNITO_USER_POOL_ID!,
      userPoolClientId: process.env.EXPO_PUBLIC_COGNITO_CLIENT_ID!,
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
    checkUser();

    // Listen for auth events
    const listener = Hub.listen("auth", (data) => {
      if (data.payload.event === "signedIn") checkUser();
      if (data.payload.event === "signedOut") setUser(null);
    });

    return () => listener();
  }, []);

  const checkUser = async () => {
    try {
      const u = await getCurrentUser();
      setUser(u);
    } catch {
      setUser(null);
    } finally {
      setIsLoaded(true);
    }
  };

  // Protect routes
  useEffect(() => {
    if (!isLoaded) return;

    const inLoginGroup = (segments[0] as string) === "login";

    if (!user && !inLoginGroup) {
      // Redirect to login if not authenticated
      router.replace("/login" as any);
    } else if (user && inLoginGroup) {
      // Redirect to tabs if authenticated and trying to access login
      router.replace("/(tabs)");
    }
  }, [user, segments, isLoaded, router]);

  return (
    <ThemeProvider value={colorScheme === "dark" ? DarkTheme : DefaultTheme}>
      <WebLayoutWrapper>
        <Stack>
          <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
          <Stack.Screen name="login" options={{ headerShown: false }} />
          <Stack.Screen
            name="modal"
            options={{ presentation: "modal", title: "Modal" }}
          />
        </Stack>
        <StatusBar style="auto" />
      </WebLayoutWrapper>
    </ThemeProvider>
  );
}
