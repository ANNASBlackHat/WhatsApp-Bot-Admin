import { useEffect, useRef, useState } from "react";
import { Stack, useLocalSearchParams, useRouter } from "expo-router";
import {
  ActivityIndicator,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { WithId } from "@app/schema";
import type { Message } from "@app/schema";
import { parseMessageContent, resolveDisplayName } from "@app/schema";
import { useThread } from "../../src/hooks";
import { fontSize, spacing, useTheme } from "../../src/theme";
import { ForwardMessageModal } from "../../src/components/ForwardMessageModal";

function formatTime(timestamp?: number): string {
  if (!timestamp) return "";
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function ThreadScreen() {
  const { colors } = useTheme();
  const { waId, userPhone } = useLocalSearchParams<{
    waId: string;
    userPhone: string;
  }>();
  const {
    snapshot,
    loading,
    loadingOlder,
    loadOlder,
    markingRead,
    markRead,
    sending,
    sendError,
    send,
    sendMedia,
    togglePin,
  } = useThread(waId ?? "", userPhone ?? "");

  const listRef = useRef<FlatList>(null);
  const [nearBottom, setNearBottom] = useState(true);
  const firstPaint = useRef(true);
  const [draft, setDraft] = useState("");
  const [forwardingMessage, setForwardingMessage] = useState<WithId<Message> | null>(null);
  const [mediaUrl, setMediaUrl] = useState("");
  const [showMediaInput, setShowMediaInput] = useState(false);

  const name = resolveDisplayName(snapshot.contact, snapshot.chat?.phone ?? userPhone ?? "");
  const unread = snapshot.chat?.unreadCount ?? 0;
  const isPinned = Boolean(snapshot.chat?.pinned);
  const defaultPolicy = snapshot.account?.default_bot_active_for_new_contacts ?? false;
  const isDefault = snapshot.chat?.bot_active == null;
  const effective = isDefault
    ? defaultPolicy
    : Boolean(snapshot.chat?.bot_active);

  const router = useRouter();

  // Scroll to bottom when keyboard opens to prevent keyboard obscuring recent messages
  useEffect(() => {
    const showEvent = Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const sub = Keyboard.addListener(showEvent, () => {
      setTimeout(() => {
        listRef.current?.scrollToEnd({ animated: true });
      }, 80);
    });
    return () => sub.remove();
  }, []);

  const handleOpenPhone = (targetPhone: string) => {
    if (!waId || !targetPhone) return;
    router.push(`/${encodeURIComponent(waId)}/${encodeURIComponent(targetPhone)}`);
  };

  const renderMessageText = (text: string) => {
    const tokens = parseMessageContent(text);
    return (
      <Text style={[styles.body, { color: colors.textPrimary }]}>
        {tokens.map((token, idx) => {
          if (token.type === "url") {
            return (
              <Text
                key={idx}
                style={[styles.link, { color: colors.active }]}
                onPress={() => Linking.openURL(token.href).catch((e) => console.error(e))}
              >
                {token.value}
              </Text>
            );
          }
          if (token.type === "wa_link" || token.type === "phone") {
            return (
              <Text
                key={idx}
                style={[styles.waLink, { color: colors.active }]}
                onPress={() => handleOpenPhone(token.phone)}
              >
                {token.value}
              </Text>
            );
          }
          return <Text key={idx}>{token.value}</Text>;
        })}
      </Text>
    );
  };

  const renderMessage = ({ item }: { item: WithId<Message> }) => {
    const incoming = item.userType === "customer";
    return (
      <View style={[styles.row, incoming ? styles.rowLeft : styles.rowRight]}>
        <View
          style={[
            styles.bubble,
            incoming
              ? { backgroundColor: colors.surface, borderColor: colors.border }
              : { backgroundColor: colors.activeBg, borderColor: colors.activeBg },
          ]}
        >
          <View style={styles.bubbleMeta}>
            <Text style={[styles.sender, { color: colors.textSecondary }]}>{incoming ? name : "Bot / Admin"}</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: spacing.sm }}>
              <Text style={[styles.metaTime, { color: colors.textMuted }]}>{formatTime(item.timeMillis)}</Text>
              <TouchableOpacity onPress={() => setForwardingMessage(item)}>
                <Text style={[styles.forwardBtnText, { color: colors.active }]}>↗</Text>
              </TouchableOpacity>
            </View>
          </View>
          {item.message ? renderMessageText(item.message) : null}
          {!item.message && (item.imgUrl || item.fileUrl) ? (
            <Text style={[styles.body, { color: colors.textSecondary }]}>[attachment — open web app to view]</Text>
          ) : null}
          {item.status === "pending" ? (
            <Text style={[styles.pending, { color: colors.textMuted }]}>⏳ pending…</Text>
          ) : item.status === "unconfirmed" ? (
            <Text style={[styles.pendingWarn, { color: colors.danger }]}>⚠️ delivery not confirmed</Text>
          ) : null}
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { backgroundColor: colors.canvas }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 90 : 0}
    >
      <Stack.Screen
        options={{
          title: name,
          headerRight: () => (
            <TouchableOpacity
              style={styles.headerPinBtn}
              onPress={() => void togglePin()}
              activeOpacity={0.7}
              accessibilityLabel={isPinned ? "Unpin chat" : "Pin chat"}
            >
              <Text style={styles.headerPinText}>{isPinned ? "📌" : "📍"}</Text>
            </TouchableOpacity>
          ),
        }}
      />

      <View style={[styles.header, { backgroundColor: colors.surface, borderBottomColor: colors.border }]}>
        <View style={[styles.avatar, { backgroundColor: colors.surfaceHover }]}>
          <Text style={[styles.avatarText, { color: colors.textPrimary }]}>{String(name).charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.headerBody}>
          <Text style={[styles.name, { color: colors.textPrimary }]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[styles.mono, { color: colors.textSecondary }]}>{userPhone}</Text>
        </View>
        <View
          style={[
            styles.status,
            { backgroundColor: effective ? colors.activeBg : colors.pausedBg },
          ]}
        >
          <Text style={{ color: effective ? colors.active : colors.paused, fontSize: 11, fontWeight: "600" }}>
            {effective ? "Active" : "Paused"}
          </Text>
        </View>
        {unread > 0 ? (
          <TouchableOpacity
            style={[styles.readBtn, { borderColor: colors.border }]}
            onPress={markRead}
            disabled={markingRead}
          >
            <Text style={[styles.readBtnText, { color: colors.textPrimary }]}>
              {markingRead ? "..." : `Read (${unread})`}
            </Text>
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.textPrimary} />
          <Text style={[styles.muted, { color: colors.textSecondary }]}>Loading messages...</Text>
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
                  <ActivityIndicator size="small" color={colors.textPrimary} />
                ) : (
                  <Text style={[styles.olderText, { color: colors.textSecondary }]}>↑ Load older messages</Text>
                )}
              </TouchableOpacity>
            ) : null
          }
          ListEmptyComponent={
            <Text style={[styles.empty, { color: colors.textSecondary }]}>No messages in this thread.</Text>
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

      {/* Manual reply composer */}
      {showMediaInput && (
        <View style={[styles.mediaComposer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
          <TextInput
            style={[
              styles.input,
              {
                backgroundColor: colors.canvas,
                borderColor: colors.border,
                color: colors.textPrimary,
              },
            ]}
            placeholder="Image or doc URL..."
            placeholderTextColor={colors.textMuted}
            value={mediaUrl}
            onChangeText={setMediaUrl}
          />
        </View>
      )}
      <View style={[styles.composer, { backgroundColor: colors.surface, borderTopColor: colors.border }]}>
        {sendError ? (
          <Text style={[styles.sendError, { color: colors.danger }]}>{sendError}</Text>
        ) : null}
        <TouchableOpacity
          style={[styles.attachBtn, { backgroundColor: colors.surfaceHover }]}
          onPress={() => setShowMediaInput(!showMediaInput)}
        >
          <Text style={[styles.attachBtnText, { color: colors.textSecondary }]}>{showMediaInput ? "✕" : "+"}</Text>
        </TouchableOpacity>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.canvas,
              borderColor: colors.border,
              color: colors.textPrimary,
            },
          ]}
          placeholder="Type a manual reply..."
          placeholderTextColor={colors.textMuted}
          value={draft}
          onChangeText={setDraft}
          multiline
        />
        <TouchableOpacity
          style={[
            styles.sendBtn,
            { backgroundColor: colors.textPrimary },
            (sending || (!draft.trim() && !mediaUrl.trim())) && styles.sendBtnDisabled,
          ]}
          disabled={sending || (!draft.trim() && !mediaUrl.trim())}
          onPress={() => {
            if (mediaUrl.trim()) {
              void sendMedia({ url: mediaUrl.trim(), type: "image", caption: draft });
              setDraft("");
              setMediaUrl("");
              setShowMediaInput(false);
            } else {
              const text = draft;
              setDraft("");
              void send(text);
            }
          }}
        >
          {sending ? (
            <ActivityIndicator size="small" color={colors.surface} />
          ) : (
            <Text style={[styles.sendBtnText, { color: colors.surface }]}>Send</Text>
          )}
        </TouchableOpacity>
      </View>
      <ForwardMessageModal
        visible={!!forwardingMessage}
        onClose={() => setForwardingMessage(null)}
        waId={waId ?? ""}
        messageToForward={forwardingMessage}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  headerPinBtn: {
    padding: 6,
    marginRight: 4,
  },
  headerPinText: {
    fontSize: fontSize.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    gap: spacing.sm,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: fontSize.md, fontWeight: "600" },
  headerBody: { flex: 1 },
  name: { fontSize: fontSize.sm, fontWeight: "600" },
  mono: { fontSize: fontSize.xs, fontFamily: "monospace" },
  status: { borderRadius: 12, paddingHorizontal: spacing.sm, paddingVertical: 4 },
  readBtn: {
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  readBtnText: { fontSize: fontSize.xs },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: spacing.sm },
  muted: { fontSize: fontSize.sm },
  list: { flex: 1 },
  listContent: { padding: spacing.md, gap: spacing.sm },
  older: { alignItems: "center", padding: spacing.sm },
  olderText: { fontSize: fontSize.xs },
  empty: {
    textAlign: "center",
    fontSize: fontSize.sm,
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
  bubbleMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: 2,
  },
  sender: { fontSize: 10, fontWeight: "600" },
  metaTime: { fontSize: 10 },
  body: { fontSize: fontSize.sm },
  link: { fontSize: fontSize.sm, textDecorationLine: "underline" },
  waLink: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    textDecorationLine: "underline",
    fontFamily: "monospace",
  },
  pending: { fontSize: 10, marginTop: 2 },
  pendingWarn: { fontSize: 10, marginTop: 2 },
  composer: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    padding: spacing.md,
    borderTopWidth: 1,
  },
  sendError: { position: "absolute", top: -18, left: spacing.md, fontSize: fontSize.xs },
  input: {
    flex: 1,
    minHeight: 38,
    maxHeight: 120,
    borderRadius: 8,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: fontSize.sm,
  },
  sendBtn: {
    minWidth: 72,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.4 },
  sendBtnText: { fontSize: fontSize.sm, fontWeight: "500" },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  attachBtnText: { fontSize: fontSize.lg },
  mediaComposer: {
    padding: spacing.md,
    borderTopWidth: 1,
  },
  forwardBtnText: {
    fontSize: fontSize.md,
  },
});
