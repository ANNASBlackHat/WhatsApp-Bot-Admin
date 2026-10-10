import { useEffect, useMemo, useState } from "react";
import { Link, Stack, useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { WithId } from "@app/schema";
import type { Chat } from "@app/schema";
import {
  effectiveFolders,
  matchesTab,
  resolveDisplayName,
  type TabKey,
} from "@app/schema";
import { useAccounts, useChatsList } from "../../src/hooks";
import { fontSize, spacing, useTheme } from "../../src/theme";
import { AccountSwitcherModal } from "../../src/components/AccountSwitcherModal";
import { auth } from "../../src/firebase";
import { signOut } from "@react-native-firebase/auth";
import { setLastSelectedWaId } from "../../src/storage";

type Filter = TabKey;

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
  const { colors } = useTheme();
  const { waId } = useLocalSearchParams<{ waId: string }>();
  const { accounts } = useAccounts();
  const [switcherVisible, setSwitcherVisible] = useState(false);

  useEffect(() => {
    if (waId) {
      setLastSelectedWaId(waId);
    }
  }, [waId]);

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
    togglePinChat,
  } = useChatsList(waId ?? "");

  const activeAccount = accounts.find((a) => a.waId === waId);
  const currentDisplayName = activeAccount?.displayName || account?.display_name || waId || "Account";

  const [filter, setFilter] = useState<Filter>("default");
  const [query, setQuery] = useState("");

  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;
  const folders = effectiveFolders(account);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = chats.filter((chat) => {
      const phone = chat.phone || chat.id;
      const contact = contactsMap[phone] ?? contactsMap[chat.id];
      const name = resolveDisplayName(contact, phone);
      if (q) {
        const hit =
          name.toLowerCase().includes(q) ||
          phone.toLowerCase().includes(q) ||
          (chat.lastChatMessage ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      return matchesTab(chat, filter, defaultPolicyActive);
    });

    // Pinned chats appear at the top, then sorted by newest activity
    return list.slice().sort((a, b) => {
      const pinA = Boolean(a.pinned);
      const pinB = Boolean(b.pinned);
      if (pinA !== pinB) return pinA ? -1 : 1;
      return (b.lastChatTime ?? 0) - (a.lastChatTime ?? 0);
    });
  }, [chats, contactsMap, query, filter, defaultPolicyActive]);

  const tabCounts = useMemo(() => {
    const keys: TabKey[] = [
      "default",
      "active",
      "paused",
      ...folders.map((f) => f.key as TabKey),
    ];
    const counts: Record<string, number> = {};
    for (const c of chats) {
      for (const k of keys) {
        if (matchesTab(c, k, defaultPolicyActive)) counts[k] = (counts[k] ?? 0) + 1;
      }
    }
    return counts;
  }, [chats, folders, defaultPolicyActive]);

  const statusTabs: { key: TabKey; label: string }[] = [
    { key: "default", label: "Default" },
    { key: "active", label: "Active" },
    { key: "paused", label: "Paused" },
  ];

  const handleLongPress = (item: WithId<Chat>, phone: string, name: string) => {
    const isPinned = Boolean(item.pinned);
    Alert.alert(
      name,
      isPinned ? "Unpin this conversation from top?" : "Pin this conversation to top?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: isPinned ? "Unpin" : "Pin to top",
          onPress: () => void togglePinChat(phone, isPinned),
        },
      ]
    );
  };

  const renderRow = ({ item }: { item: WithId<Chat> }) => {
    const phone = item.phone || item.id;
    const contact = contactsMap[phone] ?? contactsMap[item.id];
    const name = resolveDisplayName(contact, phone);
    const isDefault = item.bot_active == null;
    const effective = isDefault ? defaultPolicyActive : Boolean(item.bot_active);
    const unread = item.unreadCount ?? 0;
    const isPinned = Boolean(item.pinned);

    return (
      <Link
        href={`/${encodeURIComponent(waId ?? "")}/${encodeURIComponent(phone)}`}
        asChild
      >
        <TouchableOpacity
          style={[styles.row, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}
          onLongPress={() => handleLongPress(item, phone, name)}
          delayLongPress={400}
        >
          <View style={[styles.avatar, { backgroundColor: colors.surfaceHover }]}>
            <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{name.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.rowBody}>
            <View style={styles.rowTop}>
              <View style={styles.nameRow}>
                {isPinned ? <Text style={styles.pinBadge}>📌 </Text> : null}
                <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
                  {name}
                </Text>
              </View>
              <Text style={[styles.time, { color: colors.textMuted }]}>{formatTime(item.lastChatTime)}</Text>
            </View>
            <Text style={[styles.preview, { color: colors.textSecondary }]} numberOfLines={1}>
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
              <View style={[styles.badge, { backgroundColor: colors.danger }]}>
                <Text style={styles.badgeText}>{unread > 99 ? "99+" : String(unread)}</Text>
              </View>
            ) : null}
          </View>
        </TouchableOpacity>
      </Link>
    );
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (e) {
      console.error("Sign out error:", e);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.canvas }]}>
      <Stack.Screen
        options={{
          title: "Conversations",
          headerBackVisible: false,
          headerLeft: () => null,
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerProfileBtn}
              onPress={() => setSwitcherVisible(true)}
              activeOpacity={0.8}
              accessibilityLabel="Switch WhatsApp Account"
            >
              <View style={[styles.headerProfileAvatar, { backgroundColor: colors.active }]}>
                <Text style={styles.headerProfileAvatarText}>
                  {currentDisplayName.charAt(0).toUpperCase()}
                </Text>
              </View>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.header, { backgroundColor: colors.surface }]}>
        <TextInput
          style={[styles.search, { backgroundColor: colors.canvas, borderColor: colors.border, color: colors.textPrimary }]}
          placeholder="Search name, phone, message..."
          placeholderTextColor={colors.textMuted}
          value={query}
          onChangeText={setQuery}
        />
        <View style={styles.metaRow}>
          <Text style={[styles.count, { color: colors.textSecondary }]}>
            {totalChats != null && totalChats > chats.length
              ? `Showing ${chats.length} of ${totalChats}`
              : `${totalChats ?? chats.length} chats`}
            {unreadTotal > 0 ? ` · ${unreadTotal} unread` : ""}
          </Text>
          <Text style={[styles.currentAccountBadge, { color: colors.textSecondary }]} numberOfLines={1}>
            {currentDisplayName}
          </Text>
        </View>
        <View style={styles.pills}>
          {[...statusTabs, ...folders.map((f) => ({ key: f.key as TabKey, label: f.name }))].map(
            (tab) => {
              const active = filter === tab.key;
              return (
                <TouchableOpacity
                  key={tab.key}
                  style={[
                    styles.pill,
                    { backgroundColor: active ? colors.textPrimary : colors.canvas },
                  ]}
                  onPress={() => setFilter(tab.key)}
                >
                  <Text
                    style={[
                      styles.pillText,
                      { color: active ? colors.surface : colors.textSecondary },
                    ]}
                  >
                    {tab.label} ({tabCounts[tab.key] ?? 0})
                  </Text>
                </TouchableOpacity>
              );
            }
          )}
        </View>
      </View>

      <AccountSwitcherModal
        visible={switcherVisible}
        currentWaId={waId ?? ""}
        accounts={accounts}
        onClose={() => setSwitcherVisible(false)}
        onLogout={handleLogout}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textPrimary} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading contacts...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={[styles.error, { color: colors.danger }]}>{error}</Text>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          renderItem={renderRow}
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              {query ? "No chats match your search." : "No chats in this folder."}
            </Text>
          }
          ListFooterComponent={
            hasMore ? (
              <TouchableOpacity
                style={styles.more}
                onPress={loadMore}
                disabled={loadingMore}
              >
                {loadingMore ? (
                  <ActivityIndicator color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.moreText, { color: colors.textSecondary }]}>
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
  root: { flex: 1 },
  headerProfileBtn: {
    padding: 4,
    marginRight: 4,
  },
  headerProfileAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  headerProfileAvatarText: {
    fontSize: fontSize.sm,
    fontWeight: "700",
    color: "#FFFFFF",
  },
  header: { padding: spacing.md, gap: spacing.sm },
  metaRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  count: { fontSize: fontSize.xs },
  currentAccountBadge: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
  search: {
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
  },
  pillText: { fontSize: fontSize.xs, fontWeight: "500" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { fontSize: fontSize.sm },
  error: { fontSize: fontSize.sm },
  empty: {
    textAlign: "center",
    fontSize: fontSize.sm,
    marginTop: spacing.xl,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.md,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize.md, fontWeight: "600" },
  rowBody: { flex: 1 },
  rowTop: { flexDirection: "row", justifyContent: "space-between", gap: spacing.sm, alignItems: "center" },
  nameRow: { flex: 1, flexDirection: "row", alignItems: "center" },
  pinBadge: { fontSize: fontSize.xs },
  name: { flex: 1, fontSize: fontSize.sm, fontWeight: "600" },
  time: { fontSize: fontSize.xs },
  preview: { fontSize: fontSize.xs, marginTop: 2 },
  rowRight: { alignItems: "flex-end", gap: spacing.xs },
  dot: { width: 8, height: 8, borderRadius: 4 },
  badge: {
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
  },
  badgeText: { color: "#FFFFFF", fontSize: 10, fontWeight: "700" },
  more: { padding: spacing.lg, alignItems: "center" },
  moreText: { fontSize: fontSize.sm },
});
