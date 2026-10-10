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
import { colors, fontSize, spacing, useTheme } from "../src/theme";
import { useRouter } from "expo-router";
import { setLastSelectedWaId } from "../src/storage";

export default function AccountsScreen() {
  const { colors } = useTheme();
  const { accounts, loading } = useAccounts();
  const router = useRouter();

  if (loading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <ActivityIndicator color={colors.textPrimary} />
        <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading accounts...</Text>
      </View>
    );
  }

  if (accounts.length === 0) {
    return (
      <View style={[styles.center, { backgroundColor: colors.canvas }]}>
        <Text style={[styles.muted, { color: colors.textSecondary }]}>No WhatsApp accounts found.</Text>
      </View>
    );
  }

  const handleSelect = (waId: string) => {
    setLastSelectedWaId(waId);
    router.replace(`/${encodeURIComponent(waId)}/chats`);
  };

  return (
    <FlatList
      style={[styles.list, { backgroundColor: colors.canvas }]}
      data={accounts}
      keyExtractor={(a) => a.waId}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onPress={() => handleSelect(item.waId)}
        >
          <View style={[styles.avatar, { backgroundColor: colors.surfaceHover }]}>
            <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
              {item.displayName.charAt(0).toUpperCase()}
            </Text>
          </View>
          <View style={styles.rowBody}>
            <Text style={[styles.name, { color: colors.textPrimary }]}>{item.displayName}</Text>
            <Text style={[styles.mono, { color: colors.textSecondary }]}>{item.waId}</Text>
          </View>
          <Text style={[styles.chevron, { color: colors.textMuted }]}>›</Text>
        </TouchableOpacity>
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
