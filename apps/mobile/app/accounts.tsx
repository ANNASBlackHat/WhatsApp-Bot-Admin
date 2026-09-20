import { Link } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useAccounts } from "../src/hooks";
import { colors, fontSize, spacing } from "../src/theme";

export default function AccountsScreen() {
  const { accounts, loading } = useAccounts();

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.muted}>Loading accounts...</Text>
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.muted}>No WhatsApp accounts found.</Text>
      </View>
    );
  }

  return (
    <FlatList
      style={styles.list}
      data={accounts}
      keyExtractor={(a) => a.waId}
      renderItem={({ item }) => (
        <Link href={`/${encodeURIComponent(item.waId)}/chats`} asChild>
          <TouchableOpacity style={styles.row}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {item.displayName.charAt(0).toUpperCase()}
              </Text>
            </View>
            <View style={styles.rowBody}>
              <Text style={styles.name}>{item.displayName}</Text>
              <Text style={styles.mono}>{item.waId}</Text>
            </View>
            <Text style={styles.chevron}>›</Text>
          </TouchableOpacity>
        </Link>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { flex: 1, backgroundColor: colors.canvas },
  center: {
    flex: 1,
    backgroundColor: colors.canvas,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
  },
  muted: { fontSize: fontSize.sm, color: colors.textSecondary },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize.md, fontWeight: "600", color: colors.textPrimary },
  rowBody: { flex: 1 },
  name: { fontSize: fontSize.md, fontWeight: "600", color: colors.textPrimary },
  mono: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: "monospace" },
  chevron: { fontSize: fontSize.xl, color: colors.textMuted },
});
