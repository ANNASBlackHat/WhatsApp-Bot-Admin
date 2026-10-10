import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useChatsList } from "../hooks";
import { chatSource } from "../data";
import type { Message, WithId } from "@app/schema";
import { fontSize, spacing, useTheme } from "../theme";

export interface ForwardMessageModalProps {
  visible: boolean;
  onClose: () => void;
  waId: string;
  messageToForward: WithId<Message> | null;
}

export function ForwardMessageModal({
  visible,
  onClose,
  waId,
  messageToForward,
}: ForwardMessageModalProps) {
  const { colors } = useTheme();
  const { chats, loading } = useChatsList(waId);
  const [search, setSearch] = useState("");
  const [forwardingPhone, setForwardingPhone] = useState<string | null>(null);

  if (!visible || !messageToForward) return null;

  const filteredChats = chats.filter((c) =>
    (c.phone || "").toLowerCase().includes(search.toLowerCase())
  );

  const handleForward = async (targetPhone: string) => {
    if (forwardingPhone) return;
    setForwardingPhone(targetPhone);
    try {
      await chatSource.forwardMessage(waId, targetPhone, messageToForward);
      onClose();
    } catch (err) {
      console.error("Failed to forward message:", err);
      alert("Failed to forward message.");
    } finally {
      setForwardingPhone(null);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.overlay}>
        <View style={[styles.modal, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.textPrimary }]}>Forward Message</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={[styles.closeBtnText, { color: colors.textSecondary }]}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={[
              styles.searchInput,
              {
                borderColor: colors.border,
                color: colors.textPrimary,
                backgroundColor: colors.canvas,
              },
            ]}
            placeholder="Search contacts by phone..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {loading && chats.length === 0 ? (
            <ActivityIndicator style={styles.loader} color={colors.textPrimary} />
          ) : (
            <FlatList
              data={filteredChats}
              keyExtractor={(c) => c.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={[styles.contactItem, { borderBottomColor: colors.border }]}
                  disabled={!!forwardingPhone}
                  onPress={() => handleForward(item.phone)}
                >
                  <Text style={[styles.contactName, { color: colors.textPrimary }]}>{item.phone}</Text>
                  {forwardingPhone === item.phone ? (
                    <ActivityIndicator size="small" color={colors.active} />
                  ) : (
                    <Text style={[styles.forwardText, { color: colors.active }]}>Forward</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>No contacts found.</Text>
              }
            />
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "flex-end",
  },
  modal: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    padding: spacing.md,
    height: "75%",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: spacing.md,
  },
  title: {
    fontSize: fontSize.lg,
    fontWeight: "600",
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    fontSize: fontSize.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  loader: {
    marginTop: spacing.xl,
  },
  list: {
    flex: 1,
  },
  contactItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: spacing.md,
    borderBottomWidth: 1,
  },
  contactName: {
    fontSize: fontSize.md,
  },
  forwardText: {
    fontSize: fontSize.sm,
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    marginTop: spacing.xl,
    fontSize: fontSize.sm,
  },
});
