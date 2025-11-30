import { type JSX } from "react";
import { Linking, Pressable, StyleSheet, Text } from "react-native";

export function Card({
  className,
  title,
  children,
  href,
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
  href: string;
}): JSX.Element {
  return (
    <Pressable
      style={styles.card}
      onPress={() =>
        Linking.openURL(
          `${href}?utm_source=create-turbo&utm_medium=basic&utm_campaign=create-turbo"`
        )
      }
    >
      <Text style={styles.title}>
        {title} <Text>→</Text>
      </Text>
      <Text style={styles.content}>{children}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderWidth: 1,
    borderColor: "#eaeaea",
    borderRadius: 8,
    marginVertical: 8,
    backgroundColor: "white",
  },
  title: {
    fontSize: 18,
    fontWeight: "bold",
    marginBottom: 8,
  },
  content: {
    fontSize: 14,
    color: "#666",
  },
});
