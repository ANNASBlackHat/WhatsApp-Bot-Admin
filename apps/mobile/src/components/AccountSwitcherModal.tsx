import React from "react";
import {
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
  FlatList,
} from "react-native";
import { useRouter } from "expo-router";
import { colors, fontSize, spacing } from "../theme";
import type { AccountOption } from "../hooks";

import { setLastSelectedWaId } from "../storage";

interface AccountSwitcherModalProps {
  visible: boolean;
  currentWaId: string;
  accounts: AccountOption[];
  onClose: () => void;
  onLogout?: () => void;
}

export function AccountSwitcherModal({
  visible,
  currentWaId,
  accounts,
  onClose,
  onLogout,
}: AccountSwitcherModalProps) {
  const router = useRouter();

  const handleSelectAccount = (waId: string) => {
    onClose();
    if (waId !== currentWaId) {
      setLastSelectedWaId(waId);
      router.replace(`/${encodeURIComponent(waId)}/chats`);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableWithoutFeedback onPress={onClose}>
        <View style={styles.overlay}>
          <TouchableWithoutFeedback>
            <View style={styles.dialog}>
              {/* Header */}
              <View style={styles.header}>
                <Text style={styles.title}>WhatsApp Accounts</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={styles.closeBtn}>✕</Text>
                </TouchableOpacity>
              </View>

              {/* Accounts List (Gmail-like dialog rows) */}
              <FlatList
                data={accounts}
                keyExtractor={(item) => item.waId}
                contentContainerStyle={styles.listContent}
                renderItem={({ item }) => {
                  const isSelected = item.waId === currentWaId;
                  return (
                    <TouchableOpacity
                      style={[styles.accountRow, isSelected && styles.accountRowSelected]}
                      onPress={() => handleSelectAccount(item.waId)}
                    >
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={styles.accountName} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <Text style={styles.accountId} numberOfLines={1}>
                          {item.waId}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={styles.checkBadge}>
                          <Text style={styles.checkText}>✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Footer action: Logout or switch */}
              {onLogout && (
                <View style={styles.footer}>
                  <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                    <Text style={styles.logoutText}>Sign out of this session</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: colors.surface,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 8,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  closeBtn: {
    fontSize: fontSize.md,
    color: colors.textSecondary,
    fontWeight: "600",
  },
  listContent: {
    paddingVertical: spacing.sm,
  },
  accountRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  accountRowSelected: {
    backgroundColor: colors.surfaceHover,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: colors.surfaceHover,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
    color: colors.textPrimary,
  },
  accountId: {
    fontSize: fontSize.xs,
    color: colors.textSecondary,
    fontFamily: "monospace",
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.active,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: colors.white,
    fontSize: 11,
    fontWeight: "700",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    padding: spacing.md,
    alignItems: "center",
  },
  logoutBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  logoutText: {
    fontSize: fontSize.xs,
    color: colors.danger,
    fontWeight: "500",
  },
});
