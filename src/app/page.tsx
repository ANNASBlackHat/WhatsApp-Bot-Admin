"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { collection, getDocs, limit, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { getCookie, setCookie } from "@/lib/utils";

export default function RootPage() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function resolveRootAccount() {
      // 1. Check if last_wa_id cookie is set
      const lastWaId = getCookie("last_wa_id");
      if (lastWaId) {
        router.replace(`/${encodeURIComponent(lastWaId)}`);
        return;
      }

      // 2. First visit: query wa_bot collection for the first available account
      try {
        const q = query(collection(db, "wa_bot"), limit(1));
        const snapshot = await getDocs(q);

        if (!snapshot.empty) {
          const firstWaId = snapshot.docs[0].id;
          setCookie("last_wa_id", firstWaId);
          router.replace(`/${encodeURIComponent(firstWaId)}`);
        } else {
          setError(
            "No WhatsApp accounts found in Firestore (collection 'wa_bot'). Please add a wa_bot/{waId} document to start."
          );
        }
      } catch (err) {
        console.error("Failed to query root wa_bot accounts:", err);
        setError("Failed to resolve WhatsApp account. Please check Firestore permissions.");
      }
    }

    resolveRootAccount();
  }, [router]);

  return (
    <main className="flex min-h-[60vh] items-center justify-center p-6 text-center">
      {error ? (
        <div className="max-w-md rounded-lg border border-border-custom bg-surface p-6 shadow-xs space-y-2">
          <p className="text-sm font-medium text-accent-paused">Account Resolution Notice</p>
          <p className="text-xs text-text-secondary">{error}</p>
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-text-primary border-t-transparent" />
          <p className="text-xs text-text-secondary">Resolving WhatsApp account...</p>
        </div>
      )}
    </main>
  );
}

