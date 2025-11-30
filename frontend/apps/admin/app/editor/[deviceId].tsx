import { RoiEditor } from "@/components/RoiEditor";
import { ThemedView } from "@/components/themed-view";
import { useLocalSearchParams } from "expo-router";
import { StyleSheet } from "react-native";

export default function EditorScreen() {
  const { deviceId } = useLocalSearchParams<{ deviceId: string }>();

  if (!deviceId) {
    return (
      <ThemedView style={styles.container}>
        <ThemedView>No Device ID provided</ThemedView>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <RoiEditor deviceId={deviceId} />
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
