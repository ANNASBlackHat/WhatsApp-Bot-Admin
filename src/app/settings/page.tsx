"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, onSnapshot, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { WA_ID, waAccountDoc, chatCollection } from "@/lib/firestore-paths";
import { Chat, WaAccount } from "@/types/firestore";

export default function SettingsPage() {
  const [account, setAccount] = useState<WaAccount | null>(null);
  const [activeContactsCount, setActiveContactsCount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(Boolean(WA_ID));
  const [isUpdatingGlobal, setIsUpdatingGlobal] = useState<boolean>(false);
  const [isUpdatingDefault, setIsUpdatingDefault] = useState<boolean>(false);
  const [showGlobalConfirmModal, setShowGlobalConfirmModal] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!WA_ID) {
      return;
    }

    // 1. Listen to account settings
    const unsubAccount = onSnapshot(
      doc(db, waAccountDoc()),
      (snapshot) => {
        if (snapshot.exists()) {
          setAccount(snapshot.data() as WaAccount);
        } else {
          setAccount({ is_bot_active: true, default_bot_active_for_new_contacts: false });
        }
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load account settings:", err);
        setError("Failed to load settings from Firestore.");
        setLoading(false);
      }
    );

    // 2. Count active contacts for global pause warning
    const unsubChats = onSnapshot(
      collection(db, chatCollection()),
      (snapshot) => {
        let count = 0;
        const defaultActive = account?.default_bot_active_for_new_contacts ?? false;

        snapshot.docs.forEach((docSnap) => {
          const chat = docSnap.data() as Chat;
          const isEffectiveActive =
            chat.bot_active === null || chat.bot_active === undefined
              ? defaultActive
              : Boolean(chat.bot_active);

          if (isEffectiveActive) count++;
        });

        setActiveContactsCount(count);
      },
      (err) => {
        console.error("Failed to fetch chat counts:", err);
      }
    );

    return () => {
      unsubAccount();
      unsubChats();
    };
  }, [account?.default_bot_active_for_new_contacts]);

  // Handle global bot kill switch toggle click
  const handleGlobalToggleClick = () => {
    const isCurrentlyActive = account?.is_bot_active ?? true;

    if (isCurrentlyActive) {
      // Show confirmation dialog before turning off globally
      setShowGlobalConfirmModal(true);
    } else {
      // Turn back on immediately
      executeGlobalBotToggle(true);
    }
  };

  const executeGlobalBotToggle = async (targetActiveState: boolean) => {
    try {
      setIsUpdatingGlobal(true);
      setError(null);
      setShowGlobalConfirmModal(false);

      const ref = doc(db, waAccountDoc());
      await updateDoc(ref, { is_bot_active: targetActiveState }).catch(async () => {
        await setDoc(ref, { is_bot_active: targetActiveState }, { merge: true });
      });

      setSuccessMsg(
        targetActiveState
          ? "Global bot enabled successfully."
          : "Global bot kill switch activated. AI bot is now paused for all contacts."
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Failed to toggle global bot active:", err);
      setError("Failed to update global bot status.");
    } finally {
      setIsUpdatingGlobal(false);
    }
  };

  // Handle default policy toggle for new contacts
  const handleDefaultPolicyToggle = async () => {
    const currentDefault = account?.default_bot_active_for_new_contacts ?? false;
    const nextDefault = !currentDefault;

    try {
      setIsUpdatingDefault(true);
      setError(null);

      const ref = doc(db, waAccountDoc());
      await updateDoc(ref, {
        default_bot_active_for_new_contacts: nextDefault,
      }).catch(async () => {
        await setDoc(
          ref,
          { default_bot_active_for_new_contacts: nextDefault },
          { merge: true }
        );
      });

      setSuccessMsg(
        nextDefault
          ? "Default policy set to Auto-ON for new contacts."
          : "Default policy set to Auto-OFF for new contacts."
      );
      setTimeout(() => setSuccessMsg(null), 3500);
    } catch (err) {
      console.error("Failed to update default policy:", err);
      setError("Failed to update default policy.");
    } finally {
      setIsUpdatingDefault(false);
    }
  };

  const isGlobalActive = account?.is_bot_active ?? true;
  const isDefaultActive = account?.default_bot_active_for_new_contacts ?? false;

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-medium text-[#1C1C1A]">Settings</h1>
        <p className="text-xs text-[#6B6A62]">
          Manage global WhatsApp bot rules, default policies, and prompt library
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg border border-[#E7E5DD] bg-[#FAFAF8] p-3.5 text-xs text-[#B23B31]">
          {error}
        </div>
      )}

      {successMsg && (
        <div className="mb-4 rounded-lg border border-[#E7E5DD] bg-[#E7F1EB] p-3.5 text-xs text-[#2F7A5C]">
          {successMsg}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          <div className="h-32 animate-pulse rounded-lg bg-[#F3F2ED]" />
          <div className="h-28 animate-pulse rounded-lg bg-[#F3F2ED]" />
          <div className="h-24 animate-pulse rounded-lg bg-[#F3F2ED]" />
        </div>
      ) : (
        <div className="space-y-6">
          {/* Card 1: Account-Wide Global Bot Kill Switch (Visually Distinct Danger Card) */}
          <div className="rounded-lg border border-[#B23B31]/30 bg-[#F5E4E1] p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full bg-[#B23B31]" />
                  <h2 className="text-sm font-medium text-[#1C1C1A]">
                    Global Bot Switch (Account-wide)
                  </h2>
                </div>
                <p className="text-xs text-[#6B6A62] max-w-xl leading-relaxed">
                  <strong>Warning:</strong> Disabling this master kill switch immediately stops all automated AI replies across the entire WhatsApp account, overriding any per-contact settings.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                <span
                  className={`text-xs font-medium ${
                    isGlobalActive ? "text-[#2F7A5C]" : "text-[#B23B31]"
                  }`}
                >
                  {isGlobalActive ? "Bot Enabled" : "Bot Paused (Kill Switch)"}
                </span>

                <button
                  type="button"
                  disabled={isUpdatingGlobal}
                  onClick={handleGlobalToggleClick}
                  aria-label="Toggle global bot kill switch"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#B23B31] focus:ring-offset-2 disabled:opacity-50 ${
                    isGlobalActive ? "bg-[#2F7A5C]" : "bg-[#B23B31]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-sm transition duration-150 ease-in-out ${
                      isGlobalActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Card 2: Default Policy for New Contacts */}
          <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-[#1C1C1A]">
                  Default Policy for New Contacts
                </h2>
                <p className="text-xs text-[#6B6A62] max-w-xl leading-relaxed">
                  Controls whether brand-new incoming contacts start with the AI bot enabled (Auto-ON) or paused (Auto-OFF) when no per-contact override exists.
                </p>
              </div>

              <div className="flex items-center gap-3 self-start sm:self-center shrink-0">
                <span className="text-xs font-medium text-[#1C1C1A]">
                  {isDefaultActive ? "Auto-ON" : "Auto-OFF"}
                </span>

                <button
                  type="button"
                  disabled={isUpdatingDefault}
                  onClick={handleDefaultPolicyToggle}
                  aria-label="Toggle default policy for new contacts"
                  className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-[#1C1C1A] focus:ring-offset-2 disabled:opacity-50 ${
                    isDefaultActive ? "bg-[#2F7A5C]" : "bg-[#B9722F]"
                  }`}
                >
                  <span
                    className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-[#FFFFFF] shadow-sm transition duration-150 ease-in-out ${
                      isDefaultActive ? "translate-x-5" : "translate-x-0"
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Card 3: Prompt Library Navigation */}
          <div className="rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-6 shadow-xs">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="space-y-1">
                <h2 className="text-sm font-medium text-[#1C1C1A]">
                  Prompt Library
                </h2>
                <p className="text-xs text-[#6B6A62] max-w-xl">
                  Manage reusable AI persona prompts and choose the default fallback system prompt.
                </p>
              </div>

              <Link
                href="/settings/prompts"
                className="inline-flex items-center gap-1.5 rounded border border-[#E7E5DD] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#1C1C1A] transition-colors hover:bg-[#F3F2ED] focus:outline-none focus:ring-2 focus:ring-[#1C1C1A]"
              >
                <span>Manage prompts</span>
                <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Global Bot Kill Switch */}
      {showGlobalConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#1C1C1A]/40 p-4 backdrop-blur-xs">
          <div className="w-full max-w-md rounded-lg border border-[#E7E5DD] bg-[#FFFFFF] p-6 shadow-lg">
            <div className="flex items-center gap-2.5 text-[#B23B31]">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-medium text-[#1C1C1A]">
                Pause the bot for all contacts?
              </h3>
            </div>

            <p className="mt-3 text-xs text-[#6B6A62] leading-relaxed">
              This master kill switch will pause AI auto-replies across the entire WhatsApp account. There are currently <strong className="text-[#1C1C1A]">{activeContactsCount} active contact conversations</strong> that will be affected.
            </p>

            <div className="mt-6 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={() => setShowGlobalConfirmModal(false)}
                className="rounded border border-[#E7E5DD] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#1C1C1A] hover:bg-[#F3F2ED]"
              >
                Cancel
              </button>

              <button
                type="button"
                disabled={isUpdatingGlobal}
                onClick={() => executeGlobalBotToggle(false)}
                className="rounded bg-[#B23B31] px-4 py-2 text-xs font-medium text-[#FFFFFF] hover:bg-[#8F2E26] disabled:opacity-50"
              >
                {isUpdatingGlobal ? "Pausing..." : "Pause global bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
