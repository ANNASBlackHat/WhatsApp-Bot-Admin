import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { useAuthState, useAccounts } from "../src/hooks";
import { getLastSelectedWaId, setLastSelectedWaId } from "../src/storage";
import { ThemeProvider, useTheme } from "../src/theme";

function RootNav() {
  const { user, loading: authLoading } = useAuthState();
  const { accounts, loading: accountsLoading } = useAccounts();
  const segments = useSegments();
  const router = useRouter();
  const { colors, isDark } = useTheme();

  useEffect(() => {
    if (authLoading) return;
    const atLogin = segments[0] === undefined;
    if (!user && !atLogin) {
      router.replace("/");
      return;
    }
    if (user && atLogin) {
      if (accountsLoading) return;
      if (accounts.length === 0) {
        router.replace("/accounts");
        return;
      }
      getLastSelectedWaId().then((savedWaId) => {
        const target =
          savedWaId && accounts.some((a) => a.waId === savedWaId)
            ? savedWaId
            : accounts[0].waId;
        setLastSelectedWaId(target);
        router.replace(`/${encodeURIComponent(target)}/chats`);
      });
    }
  }, [user, authLoading, accounts, accountsLoading, segments, router]);

  return (
    <>
      <StatusBar style={isDark ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.surface },
          headerTintColor: colors.textPrimary,
          headerTitleStyle: { color: colors.textPrimary },
          contentStyle: { backgroundColor: colors.canvas },
        }}
      >
        <Stack.Screen name="index" options={{ title: "Sign in", headerShown: false }} />
        <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
        <Stack.Screen
          name="[waId]/chats"
          options={{
            title: "Conversations",
            headerBackVisible: false,
          }}
        />
        <Stack.Screen name="[waId]/[userPhone]" options={{ title: "Thread" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <ThemeProvider>
      <RootNav />
    </ThemeProvider>
  );
}
