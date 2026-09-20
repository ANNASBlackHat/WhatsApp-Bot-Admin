import { useMemo, useState } from "react";
import { Link, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { WithId } from "@app/schema";
import type { Chat } from "@app/schema";
import { useChatsList } from "../../src/hooks";
import { colors, fontSize, spacing } from "../../src/theme";

type Filter = "all" | "active" | "paused";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
}

export default function ChatsScreen() {
  const { waId } = useLocalSearchParams<{ waId: string }>();
  const {
    account,
    chats,
    contactsMap,
    totalChats,
    unreadTotal,
    hasMore,
    loadingMore,
    loading,
    error,
    loadMore,
  } = useChatsList(waId ?? "");

  const [filter, setFilter] = useState<Filter>("all");
  const [query, setQuery] = useState("");

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return chats.filter((chat) => {
      const phone = chat.phone || chat.id;
      const contact = contactsMap[phone] ?? contactsMap[chat.id];
      const name = contact?.name ?? phone;
      if (q) {
        const hit =
          name.toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q) ||
          (chat.lastChatMessage ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      const isDefault = chat.bot_active == null;
      const effective = isDefault ? defaultPolicyActive : Boolean(chat.bot_active);
      if (filter === "active" && !effective) return false;
      if (filter === "paused" && effective) return false;
      return true;
    });
  }, [chats, contactsMap, query, filter, defaultPolicyActive]);

  const renderRow = ({ item }: { item: WithId<Chat> }) => {
    const phone = item.phone || item.id;
    const contact = contactsMap[phone] ?? contactsMap[item.id];
    const name = contact?.name ?? phone;
    const isDefault = item.bot_active == null;
    const effective = isDefault ? defaultPolicyActive : Boolean(item.bot_active);
    const unread = item.unreadCount ?? 0;

    return (
      <Link
        href={`/${encodeURIComponent(waId ?? "")}/${encodeURIComponent(phone)}`}
        asChild
      >
        <TouchableOpacity style={styles.row}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <Text style={styles.name} numberOfLines={1}>
                {name}
              </Text>
              <Text style={styles.time}>{formatTime(item.lastChatTime)}</Text>
            </View>
            <Text style={styles.preview} numberOfLines={1}>
              {item.lastChatMessage || "No messages yet"}
            </Text>
          </View>
          <View style={styles.rowRight}>
            <View
              style={[
                styles.dot,
                { backgroundColor: effective ? colors.active : colors.paused },
              ]}
            />
            {unread > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Link>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={styles.count}>
          {totalChats != null && totalChats > chats.length
            ? `Showing ${chats.length} of ${totalChats}`
            : `${totalChats ?? chats.length} conversations`}
          {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
        </Text>
        <TextInput
          style={styles.search}
          placeholder="Search name, phone, message..."
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.pills}>
          {(["all", "active", "paused"] as Filter[]).map((f) => (
            <TouchableOpacity
              key={f}
              style={[styles.pill, filter === f && styles.pillActive]}
              onPress={() => setFilter(f)}
            >
              <Text style={[styles.pillText, filter === f && styles.pillTextActive]}>
                {f === "all" ? "All" : f === "active" ? "Active" : "Paused"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading contacts...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.error}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          ListEmptyComponent={
            <Text style={styles.empty}>No contacts found.</Text>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.more}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.moreText}>
                    Load more ({chats.length}
                    {totalChats != null ? ` of ${totalChats}` : ""})
                  </Text>
                )}
              </TouchableOpacity>
            ) : null
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: { padding: spacing.md, gap: spacing.sm, backgroundColor: colors.surface },
  count: { fontSize: fontSize.xs, color: colors.textSecondary },
  search: {
    backgroundColor: colors.canvas,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    fontSize: fontSize.sm,
  },
  pills: { flexDirection: "row", gap: spacing.sm },
  pill: {
    borderRadius: 12,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    backgroundColor: colors.canvas,
  },
  pillActive: { backgroundColor: colors.textPrimary },
  pillText: { fontSize: fontSize.xs, color: colors.textSecondary },
  pillTextActive: { color: colors.white },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { fontSize: fontSize.sm, color: colors.textSecondary },
  error: { fontSize: fontSize.sm, color: colors.danger },
  empty: {
    textAlign: "center",
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
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
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm },
  name: { flex: 1, fontSize: fontSize.sm, fontWeight: "600", color: colors.textPrimary },
  time: { fontSize: fontSize.xs, color: colors.textMuted },
  preview: { fontSize: fontSize.xs, color: colors.textSecondary, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.danger,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: colors.white, fontSize: 10, fontWeight: "700" },
  more: { padding: spacing.lg, alignItems: "center" },
  moreText: { fontSize: fontSize.sm, color: colors.textSecondary },
});
