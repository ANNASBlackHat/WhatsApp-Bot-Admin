import AsyncStorage from "@react-native-async-storage/async-storage";

const LAST_SELECTED_WA_ID_KEY = "@wa_admin_last_wa_id";

export async function getLastSelectedWaId(): Promise<string | null> {
  try {
    return await AsyncStorage.getItem(LAST_SELECTED_WA_ID_KEY);
  } catch (err) {
    console.error("Failed to read last selected waId from AsyncStorage", err);
    return null;
  }
}

export async function setLastSelectedWaId(waId: string): Promise<void> {
  try {
    if (!waId) return;
    await AsyncStorage.setItem(LAST_SELECTED_WA_ID_KEY, waId);
  } catch (err) {
    console.error("Failed to save last selected waId to AsyncStorage", err);
  }
}
