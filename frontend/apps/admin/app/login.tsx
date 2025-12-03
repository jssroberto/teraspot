import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { signIn } from "aws-amplify/auth";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

export default function LoginScreen() {
  React.useEffect(() => {
    console.log("LoginScreen mounted (useEffect)");
    return () => console.log("LoginScreen unmounted");
  }, []);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert("Error", "Please enter both email and password");
      return;
    }

    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({
        username: email,
        password,
      });

      if (isSignedIn) {
        router.replace("/(tabs)");
      } else {
        if (nextStep.signInStep === "CONFIRM_SIGN_UP") {
          Alert.alert("Error", "User is not confirmed");
        } else if (
          nextStep.signInStep === "CONFIRM_SIGN_IN_WITH_NEW_PASSWORD_REQUIRED"
        ) {
          Alert.alert(
            "Notice",
            "New password required. Please contact admin (Not implemented in this demo)."
          );
        } else {
          Alert.alert("Notice", `Next step: ${nextStep.signInStep}`);
        }
      }
    } catch (error: any) {
      console.error("Login Error Full Object:", JSON.stringify(error, null, 2));
      console.error("Login Error Message:", error.message);
      Alert.alert("Login Failed", error.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <View style={styles.content}>
        <ThemedText type="title" style={styles.title}>
          TeraSpot Admin
        </ThemedText>
        <ThemedText style={styles.subtitle}>Sign in to continue</ThemedText>

        <View style={styles.form}>
          <ThemedText style={styles.label}>Email</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="admin@teraspot.com"
            placeholderTextColor="#888"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
          />

          <ThemedText style={styles.label}>Password</ThemedText>
          <TextInput
            style={styles.input}
            placeholder="Password"
            placeholderTextColor="#888"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />

          <TouchableOpacity
            style={styles.button}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Sign In</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
  },
  content: {
    maxWidth: 400,
    width: "100%",
    alignSelf: "center",
  },
  title: {
    textAlign: "center",
    marginBottom: 10,
  },
  subtitle: {
    textAlign: "center",
    marginBottom: 40,
    opacity: 0.7,
  },
  form: {
    gap: 15,
  },
  label: {
    fontWeight: "600",
    marginBottom: 5,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    backgroundColor: "rgba(255,255,255,0.05)",
    color: "#fff", // Assuming dark mode default or handled by theme, but forcing for now as ThemedView background is likely dark
  },
  button: {
    backgroundColor: "#2196F3",
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 10,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
