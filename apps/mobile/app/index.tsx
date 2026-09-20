import { useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { signInWithEmailAndPassword } from "@react-native-firebase/auth";
import { auth } from "../src/firebase";
import { colors, fontSize, spacing } from "../src/theme";

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const handleSignIn = async () => {
    if (!email.trim() || !password || busy) return;
    setBusy(true);
    setError(null);
    try {
      // Same Firebase Auth project as the web app — admin UID rules apply.
      await signInWithEmailAndPassword(auth, email.trim(), password);
      // Root layout redirects to /accounts on auth state change.
    } catch (e) {
      console.error("Sign-in failed:", e);
      setError("Sign-in failed. Check your email, password, and connection.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <Text style={styles.title}>WA Bot Admin</Text>
      <Text style={styles.subtitle}>Sign in with your admin account</Text>

      <TextInput
        style={styles.input}
        placeholder="Email"
        autoCapitalize="none"
        keyboardType="email-address"
        value={email}
        onChangeText={setEmail}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        onSubmitEditing={handleSignIn}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <TouchableOpacity
        style={[styles.button, busy && styles.buttonBusy]}
        onPress={handleSignIn}
        disabled={busy}
      >
        {busy ? (
          <ActivityIndicator color={colors.white} />
        ) : (
          <Text style={styles.buttonText}>Sign in</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.canvas,
    padding: spacing.xl,
    justifyContent: "center",
  },
  title: { fontSize: fontSize.xl, fontWeight: "700", color: colors.textPrimary },
  subtitle: {
    fontSize: fontSize.sm,
    color: colors.textSecondary,
    marginTop: spacing.xs,
    marginBottom: spacing.xl,
  },
  input: {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 8,
    padding: spacing.md,
    fontSize: fontSize.md,
    marginBottom: spacing.md,
  },
  error: { color: colors.danger, fontSize: fontSize.sm, marginBottom: spacing.md },
  button: {
    backgroundColor: colors.textPrimary,
    borderRadius: 8,
    padding: spacing.md,
    alignItems: "center",
  },
  buttonBusy: { opacity: 0.6 },
  buttonText: { color: colors.white, fontSize: fontSize.md, fontWeight: "600" },
});
