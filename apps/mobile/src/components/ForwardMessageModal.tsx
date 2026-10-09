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
import { colors, fontSize, spacing } from "../theme";

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
        <View style={styles.modal}>
          <View style={styles.header}>
            <Text style={styles.title}>Forward Message</Text>
            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>Close</Text>
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.searchInput}
            placeholder="Search contacts by phone..."
            placeholderTextColor={colors.textMuted}
            value={search}
            onChangeText={setSearch}
          />

          {loading && chats.length === 0 ? (
            <ActivityIndicator style={styles.loader} />
          ) : (
            <FlatList
              data={filteredChats}
              keyExtractor={(c) => c.id}
              style={styles.list}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.contactItem}
                  disabled={!!forwardingPhone}
                  onPress={() => handleForward(item.phone)}
                >
                  <Text style={styles.contactName}>{item.phone}</Text>
                  {forwardingPhone === item.phone ? (
                    <ActivityIndicator size="small" color={colors.active} />
                  ) : (
                    <Text style={styles.forwardText}>Forward</Text>
                  )}
                </TouchableOpacity>
              )}
              ListEmptyComponent={
                <Text style={styles.emptyText}>No contacts found.</Text>
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
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modal: {
    backgroundColor: colors.surface,
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
    color: colors.textPrimary,
  },
  closeBtn: {
    padding: spacing.xs,
  },
  closeBtnText: {
    color: colors.textSecondary,
    fontSize: fontSize.sm,
  },
  searchInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: spacing.sm,
    color: colors.textPrimary,
    backgroundColor: colors.canvas,
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
    borderBottomColor: colors.border,
  },
  contactName: {
    fontSize: fontSize.md,
    color: colors.textPrimary,
  },
  forwardText: {
    fontSize: fontSize.sm,
    color: colors.active,
    fontWeight: "500",
  },
  emptyText: {
    textAlign: "center",
    color: colors.textSecondary,
    marginTop: spacing.xl,
    fontSize: fontSize.sm,
  },
});
