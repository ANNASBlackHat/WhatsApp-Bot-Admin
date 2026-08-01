"use client";

import React, { useEffect, useState } from "react";
import { useParams, usePathname, useRouter } from "next/navigation";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { setCookie } from "@/lib/utils";


interface AccountOption {
  waId: string;
  displayName: string;
}

export function AccountSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useParams();

  const rawWaId = params?.waId as string | undefined;
  const currentWaId = rawWaId ? decodeURIComponent(rawWaId) : "";

  const [accounts, setAccounts] = useState<AccountOption[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    // Listen to root wa_bot collection for available accounts
    const unsub = onSnapshot(
      collection(db, "wa_bot"),
      (snapshot) => {
        const list: AccountOption[] = snapshot.docs.map((docSnap) => {
          const id = docSnap.id;
          const data = docSnap.data();
          const displayName = (data.display_name as string) || id;
          return { waId: id, displayName };
        });

        setAccounts(list);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load accounts in AccountSwitcher:", err);
        setLoading(false);
      }
    );

    return () => unsub();
  }, []);

  const handleSwitch = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newWaId = e.target.value;
    if (!newWaId || newWaId === currentWaId) return;

    // Save selected account in cookie for persistent redirect on next visit
    setCookie("last_wa_id", newWaId);

    // Route preservation logic
    if (pathname.includes("/dashboard")) {
      router.push(`/${encodeURIComponent(newWaId)}/dashboard`);
    } else if (pathname.includes("/settings/prompts")) {
      router.push(`/${encodeURIComponent(newWaId)}/settings/prompts`);
    } else if (pathname.includes("/settings")) {
      router.push(`/${encodeURIComponent(newWaId)}/settings`);
    } else {
      router.push(`/${encodeURIComponent(newWaId)}`);
    }
  };

  // If no account is selected in params (e.g. login page), don't render switcher
  if (!currentWaId) return null;

  return (
    <div className="flex items-center gap-1.5 border-l border-border-custom pl-3">
      <span className="text-[11px] font-medium text-text-secondary">Account:</span>
      <select
        value={currentWaId}
        onChange={handleSwitch}
        disabled={loading}
        className="rounded border border-border-custom bg-canvas px-2.5 py-1 text-xs font-medium text-text-primary transition-colors focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary disabled:opacity-50"
      >
        {/* If current account is not yet in fetched list, show placeholder */}
        {!accounts.some((a) => a.waId === currentWaId) && (
          <option value={currentWaId}>{currentWaId}</option>
        )}
        {accounts.map((acc) => (
          <option key={acc.waId} value={acc.waId}>
            {acc.displayName} {acc.displayName !== acc.waId ? `(${acc.waId})` : ""}
          </option>
        ))}
      </select>
    </div>
  );
}

