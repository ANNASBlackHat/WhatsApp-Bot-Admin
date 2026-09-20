import { Stack, useRouter, useSegments } from "expo-router";
import { useEffect } from "react";
import { useAuthState } from "../src/hooks";

export default function RootLayout() {
  const { user, loading } = useAuthState();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    const atLogin = segments[0] === undefined;
    if (!user && !atLogin) {
      router.replace("/");
    } else if (user && atLogin) {
      router.replace("/accounts");
    }
  }, [user, loading, segments, router]);

  return (
    <Stack>
      <Stack.Screen name="index" options={{ title: "Sign in", headerShown: false }} />
      <Stack.Screen name="accounts" options={{ title: "Accounts" }} />
      <Stack.Screen name="[waId]/chats" options={{ title: "Contacts" }} />
      <Stack.Screen name="[waId]/[userPhone]" options={{ title: "Thread" }} />
    </Stack>
  );
}
