import { useRef, useState } from "react";
import { useLocalSearchParams } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import type { WithId } from "@app/schema";
import type { Message } from "@app/schema";
import { useThread } from "../../src/hooks";
import { colors, fontSize, spacing } from "../../src/theme";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ThreadScreen() {
  const { waId, userPhone } = useLocalSearchParams<{
    waId: string;
    userPhone: string;
  }>();
  const { snapshot, loading, loadingOlder, loadOlder, markingRead, markRead } =
    useThread(waId ?? "", userPhone ?? "");

  const listRef = useRef<FlatList>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const firstPaint = useRef(true);

  const name = snapshot.contact?.name ?? snapshot.chat?.phone ?? userPhone ?? "";
  const unread = snapshot.chat?.unreadCount ?? 0;
  const defaultPolicy = snapshot.account?.default_bot_active_for_new_contacts ?? false;
  const isDefault = snapshot.chat?.bot_active == null;
  const effective = isDefault
    ? defaultPolicy
    : Boolean(snapshot.chat?.bot_active);

  const renderMessage = ({ item }: { item: WithId<Message> }) => {
    const incoming = item.userType === "customer";
    return (
      <View style={[styles.row, incoming ? styles.rowLeft : styles.rowRight]}>
        <View style={[styles.bubble, incoming ? styles.bubbleIn : styles.bubbleOut]}>
          <View style={styles.bubbleMeta}>
            <Text style={styles.sender}>{incoming ? name : "Bot / Admin"}</Text>
            <Text style={styles.metaTime}>{formatTime(item.timeMillis)}</Text>
          </View>
          {item.message ? <Text style={styles.body}>{item.message}</Text> : null}
          {!item.message && (item.imgUrl || item.fileUrl) ? (
            <Text style={styles.body}>[attachment — open web app to view]</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{String(name).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={styles.name} numberOfLines={1}>
            {name}
          </Text>
          <Text style={styles.mono}>{userPhone}</Text>
        </View>
        <View
          style={[
            styles.status,
            { backgroundColor: effective ? colors.activeBg : colors.pausedBg },
          ]}
        >
          <Text style={{ color: effective ? colors.active : colors.paused, fontSize: 11 }}>
            {effective ? "Active" : "Paused"}
          </Text>
        </View>
        {unread > 0 ? (
          <TouchableOpacity
            style={styles.readBtn}
            onPress={markRead}
            disabled={markingRead}
          >
            <Text style={styles.readBtnText}>
              {markingRead ? "..." : `Read (${unread})`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator />
          <Text style={styles.muted}>Loading messages...</Text>
        </View>
      ) : (
        <FlatList
          ref={listRef}
          style={styles.list}
          contentContainerStyle={styles.listContent}
          data={snapshot.messages}
          keyExtractor={(m) => m.id}
          renderItem={renderMessage}
          ListHeaderComponent={
            snapshot.hasMoreMessages ? (
              <TouchableOpacity
                style={styles.older}
                onPress={loadOlder}
                disabled={loadingOlder}
              >
                {loadingOlder ? (
                  <ActivityIndicator size="small" />
                ) : (
                  <Text style={styles.olderText}>↑ Load older messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <Text style={styles.empty}>No messages in this thread.</Text>
          }
          onScroll={(e) => {
            const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
            setNearBottom(
              layoutMeasurement.height + contentOffset.y >= contentSize.height - 120
            );
          }}
          scrollEventThrottle={200}
          onContentSizeChange={() => {
            if (firstPaint.current || nearBottom) {
              firstPaint.current = false;
              listRef.current?.scrollToEnd({ animated: !firstPaint.current });
            }
          }}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.canvas },
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize.md, fontWeight: "600", color: colors.textPrimary },
  headerBody: { flex: 1 },
  name: { fontSize: fontSize.sm, fontWeight: "600", color: colors.textPrimary },
  mono: { fontSize: fontSize.xs, color: colors.textSecondary, fontFamily: "monospace" },
  status: { borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  readBtn: {
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  readBtnText: { fontSize: fontSize.xs, color: colors.textPrimary },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { fontSize: fontSize.sm, color: colors.textSecondary },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  older: { alignItems: "center", padding: spacing.sm },
  olderText: { fontSize: fontSize.xs, color: colors.textSecondary },
  empty: {
    textAlign: "center",
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xl,
  },
  row: { flexDirection: "row" },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "85%",
    borderRadius: 8,
    padding: spacing.sm,
    borderWidth: 1,
  },
  bubbleIn: { backgroundColor: colors.surface, borderColor: colors.border },
  bubbleOut: { backgroundColor: colors.activeBg, borderColor: colors.activeBg },
  bubbleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: 2,
  },
  sender: { fontSize: 10, fontWeight: "600", color: colors.textSecondary },
  metaTime: { fontSize: 10, color: colors.textMuted },
  body: { fontSize: fontSize.sm, color: colors.textPrimary },
});
