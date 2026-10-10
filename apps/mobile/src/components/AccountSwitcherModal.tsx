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
import { fontSize, spacing, useTheme } from "../theme";
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
  const { colors, mode, setMode } = useTheme();

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
            <View style={[styles.dialog, { backgroundColor: colors.surface }]}>
              {/* Header */}
              <View style={[styles.header, { borderBottomColor: colors.border }]}>
                <Text style={[styles.title, { color: colors.textPrimary }]}>WhatsApp Accounts</Text>
                <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                  <Text style={[styles.closeBtn, { color: colors.textSecondary }]}>✕</Text>
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
                      style={[
                        styles.accountRow,
                        isSelected && { backgroundColor: colors.surfaceHover },
                      ]}
                      onPress={() => handleSelectAccount(item.waId)}
                    >
                      <View style={[styles.avatar, { backgroundColor: colors.surfaceHover }]}>
                        <Text style={[styles.avatarText, { color: colors.textPrimary }]}>
                          {item.displayName.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={styles.accountInfo}>
                        <Text style={[styles.accountName, { color: colors.textPrimary }]} numberOfLines={1}>
                          {item.displayName}
                        </Text>
                        <Text style={[styles.accountId, { color: colors.textSecondary }]} numberOfLines={1}>
                          {item.waId}
                        </Text>
                      </View>
                      {isSelected ? (
                        <View style={[styles.checkBadge, { backgroundColor: colors.active }]}>
                          <Text style={styles.checkText}>✓</Text>
                        </View>
                      ) : null}
                    </TouchableOpacity>
                  );
                }}
              />

              {/* Theme toggle section */}
              <View style={[styles.themeSection, { borderTopColor: colors.border }]}>
                <Text style={[styles.themeLabel, { color: colors.textSecondary }]}>Appearance</Text>
                <View style={styles.themeOptions}>
                  {(["dark", "light", "system"] as const).map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.themeOptionBtn,
                        { borderColor: colors.border },
                        mode === t
                          ? { backgroundColor: colors.textPrimary, borderColor: colors.textPrimary }
                          : { backgroundColor: colors.canvas },
                      ]}
                      onPress={() => setMode(t)}
                    >
                      <Text
                        style={[
                          styles.themeOptionText,
                          { color: mode === t ? colors.surface : colors.textPrimary },
                        ]}
                      >
                        {t === "dark" ? "🌙 Dark" : t === "light" ? "☀️ Light" : "⚙️ System"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              {/* Footer action: Logout or switch */}
              {onLogout && (
                <View style={[styles.footer, { borderTopColor: colors.border }]}>
                  <TouchableOpacity style={styles.logoutBtn} onPress={onLogout}>
                    <Text style={[styles.logoutText, { color: colors.danger }]}>Sign out of this session</Text>
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
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
    padding: spacing.lg,
  },
  dialog: {
    width: "100%",
    maxWidth: 380,
    borderRadius: 16,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
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
  },
  title: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  closeBtn: {
    fontSize: fontSize.md,
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: fontSize.md,
    fontWeight: "600",
  },
  accountInfo: {
    flex: 1,
  },
  accountName: {
    fontSize: fontSize.sm,
    fontWeight: "600",
  },
  accountId: {
    fontSize: fontSize.xs,
    fontFamily: "monospace",
  },
  checkBadge: {
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  checkText: {
    color: "#FFFFFF",
    fontSize: 11,
    fontWeight: "700",
  },
  themeSection: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  themeLabel: {
    fontSize: fontSize.xs,
    fontWeight: "600",
    marginBottom: spacing.xs,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  themeOptions: {
    flexDirection: "row",
    gap: spacing.xs,
  },
  themeOptionBtn: {
    flex: 1,
    paddingVertical: spacing.xs,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  themeOptionText: {
    fontSize: fontSize.xs,
    fontWeight: "600",
  },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    padding: spacing.md,
    alignItems: "center",
  },
  logoutBtn: {
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  logoutText: {
    fontSize: fontSize.xs,
    fontWeight: "500",
  },
});
