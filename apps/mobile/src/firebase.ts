/**
 * Firebase bootstrap for the mobile app.
 *
 * No JS config here: `@react-native-firebase` is configured NATIVELY via
 * `google-services.json` (Android) and `GoogleService-Info.plist` (iOS).
 * See README.md — those files are gitignored and must be added manually.
 *
 * Persistence is automatic (native SQLite). Auth sessions persist natively
 * (Keychain / Keystore) with no extra setup.
 */
import { getAuth } from "@react-native-firebase/auth";
import { getFirestore } from "@react-native-firebase/firestore";

export const auth = getAuth();
export const db = getFirestore();
