"use client";

import React, { use, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { collection, doc, getCountFromServer, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { waAccountDoc, chatCollection } from "@/lib/firestore-paths";
import { WaAccount } from "@/types/firestore";
import { BUILTIN_FOLDER_KEYS, FOLDER_DEFAULTS } from "@/lib/chat-helpers";
import { GlobalKillSwitchCard } from "@/components/settings/global-kill-switch-card";
import { QuietHoursCard } from "@/components/settings/quiet-hours-card";
import { ChatFoldersManager } from "@/components/settings/chat-folders-manager";


interface PageProps {
  params: Promise<{ waId: string }>;
}

export default function SettingsPage({ params }: PageProps) {
  const resolvedParams = use(params);
  const waId = decodeURIComponent(resolvedParams.waId);

  const [account, setAccount] = useState<WaAccount | null>(null);

  // Contact counts via server aggregations (no document downloads) — only
  // used for the kill-switch copy ("ALL N contacts") and the active-contact
  // confirmation count.
  const [totalChatsCount, setTotalChatsCount] = useState<number>(0);
  const [explicitActiveCount, setExplicitActiveCount] = useState<number>(0);
  const [explicitPausedCount, setExplicitPausedCount] = useState<number>(0);

  const [loading, setLoading] = useState<boolean>(Boolean(waId));
  const [updatingGlobal, setUpdatingGlobal] = useState<boolean>(false);
  const [updatingDefault, setUpdatingDefault] = useState<boolean>(false);
  const [showConfirmModal, setShowConfirmModal] = useState<boolean>(false);

  // Quiet Hours states
  const [quietHoursEnabled, setQuietHoursEnabled] = useState<boolean>(false);
  const [quietStartTime, setQuietStartTime] = useState<string>("22:00");
  const [quietEndTime, setQuietEndTime] = useState<string>("07:00");
  const [quietTimezone, setQuietTimezone] = useState<string>("Asia/Jakarta");
  const [updatingQuiet, setUpdatingQuiet] = useState<boolean>(false);
  const [quietSaveStatus, setQuietSaveStatus] = useState<string | null>(null);

  // Folder manager — local draft state seeded once from the live doc; a
  // single "Save Folders" write applies everything (one Firestore write,
  // not one per keystroke). Add/remove are immediate since they're rare.
  //
  // The drafts are derived from `account.folders` when no in-progress edits
  // exist (`dirty` flag), so opening the page after a save re-reads live data
  // without a sync effect.
  const [draftBuiltins, setDraftBuiltins] = useState<Record<string, string>>({});
  const [draftCustoms, setDraftCustoms] = useState<{ key: string; name: string }[]>([]);
  const [folderEditsDirty, setFolderEditsDirty] = useState(false);
  const [newFolderName, setNewFolderName] = useState<string>("");
  const [updatingFolders, setUpdatingFolders] = useState<boolean>(false);
  const [folderSaveStatus, setFolderSaveStatus] = useState<string | null>(null);

  const builtins = useMemo(
    () => BUILTIN_FOLDER_KEYS.map((key) => ({ key, name: FOLDER_DEFAULTS.find((f) => f.key === key)!.name })),
    []
  );

  const liveFolders = useMemo(() => account?.folders ?? [], [account]);
  const hasEdits = folderEditsDirty || newFolderName.trim() !== "";

  // Pure derived view: if the admin is editing, show the draft; otherwise
  // mirror the live doc so a round-trip save re-renders inputs instantly.
  const shownBuiltins = useMemo(() => {
    const result: Record<string, string> = {};
    for (const b of builtins) {
      if (hasEdits) {
        result[b.key] = draftBuiltins[b.key] ?? b.name;
      } else {
        result[b.key] = liveFolders.find((f) => f.key === b.key)?.name ?? b.name;
      }
    }
    return result;
  }, [builtins, draftBuiltins, liveFolders, hasEdits]);

  const shownCustoms = useMemo(() => {
    if (hasEdits) return draftCustoms;
    return liveFolders.filter((f) => !(BUILTIN_FOLDER_KEYS as readonly string[]).includes(f.key));
  }, [draftCustoms, liveFolders, hasEdits]);

  // Seed the drafts lazily on the first local edit.
  const ensureSeeded = () => {
    if (folderEditsDirty) return;
    setDraftBuiltins(
      builtins.reduce<Record<string, string>>((acc, b) => {
        acc[b.key] = liveFolders.find((f) => f.key === b.key)?.name ?? b.name;
        return acc;
      }, {})
    );
    setDraftCustoms(
      liveFolders.filter((f) => !(BUILTIN_FOLDER_KEYS as readonly string[]).includes(f.key))
    );
    setFolderEditsDirty(true);
  };

  const handleSaveFolders = async () => {
    if (!hasEdits) {
      setFolderSaveStatus("Nothing to save.");
      setTimeout(() => setFolderSaveStatus(null), 2000);
      return;
    }
    try {
      setUpdatingFolders(true);
      setFolderSaveStatus(null);
      const next: { key: string; name: string }[] = [
        ...builtins.map((b) => ({ key: b.key, name: shownBuiltins[b.key] ?? b.name })),
        ...shownCustoms,
      ];
      const targetRef = doc(db, waAccountDoc(waId));
      await updateDoc(targetRef, { folders: next }).catch(async () => {
        await setDoc(targetRef, { folders: next }, { merge: true });
      });
      setFolderEditsDirty(false);
      setNewFolderName("");
      setFolderSaveStatus("Folders saved successfully.");
      setTimeout(() => setFolderSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to save folders:", err);
      setFolderSaveStatus("Failed to save folders.");
    } finally {
      setUpdatingFolders(false);
    }
  };

  const handleAddCustomFolder = () => {
    ensureSeeded();
    const name = newFolderName.trim();
    if (!name) return;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    if (!key || BUILTIN_FOLDER_KEYS.includes(key as (typeof BUILTIN_FOLDER_KEYS)[number]) ||
        draftCustoms.some((f) => f.key === key)) {
      setFolderSaveStatus("Folder name already in use.");
      return;
    }
    setDraftCustoms((prev) => [...prev, { key, name }]);
    setNewFolderName("");
    setFolderSaveStatus(null);
  };

  const handleRemoveCustomFolder = (key: string) => {
    // Chats in a deleted folder fall back to the default view (folder = null).
    // The folder reference in existing chat docs is harmless — matchesTab
    // simply won't show them under any tab except via search.
    ensureSeeded();
    setDraftCustoms((prev) => prev.filter((f) => f.key !== key));
    setFolderSaveStatus(null);
  };

  useEffect(() => {

    if (!waId) return;

    const signal = { cancelled: false };

    // 1. Account document listener
    const unsubAccount = onSnapshot(
      doc(db, waAccountDoc(waId)),
      (snapshot) => {
        if (snapshot.exists()) {
          const accData = snapshot.data() as WaAccount;
          setAccount(accData);
          if (accData.quiet_hours) {
            setQuietHoursEnabled(Boolean(accData.quiet_hours.enabled));
            setQuietStartTime(accData.quiet_hours.start_time || "22:00");
            setQuietEndTime(accData.quiet_hours.end_time || "07:00");
            setQuietTimezone(accData.quiet_hours.timezone || "Asia/Jakarta");
          }
        } else {
          setAccount(null);
        }
        setLoading(false);
      },
      (err) => {
        console.error("Settings account snapshot error:", err);
        setLoading(false);
      }
    );


    // 2. Contact counts for the kill-switch copy (aggregations only).
    const chatsCol = collection(db, chatCollection(waId));
    Promise.all([
      getCountFromServer(chatsCol),
      getCountFromServer(query(chatsCol, where("bot_active", "==", true))),
      getCountFromServer(query(chatsCol, where("bot_active", "==", false))),
    ])
      .then(([totalSnap, activeSnap, pausedSnap]) => {
        if (signal.cancelled) return;
        setTotalChatsCount(totalSnap.data().count);
        setExplicitActiveCount(activeSnap.data().count);
        setExplicitPausedCount(pausedSnap.data().count);
      })
      .catch((err) => console.error("Settings counts aggregation error:", err));

    return () => {
      signal.cancelled = true;
      unsubAccount();
    };
  }, [waId]);

  const isGlobalActive = account?.is_bot_active ?? true;
  const defaultPolicyActive = account?.default_bot_active_for_new_contacts ?? false;

  // Active contacts affected by the global kill switch. Docs with bot_active
  // unset match neither == true nor == false, so they fall back to the
  // default policy.
  const defaultCount = Math.max(
    0,
    totalChatsCount - explicitActiveCount - explicitPausedCount
  );
  const activeContactsCount =
    explicitActiveCount + (defaultPolicyActive ? defaultCount : 0);

  // Trigger kill switch confirmation modal
  const handleInitiateGlobalToggle = (nextState: boolean) => {
    if (!nextState) {
      // Disabling global bot requires confirmation
      setShowConfirmModal(true);
    } else {
      // Enabling global bot can execute directly
      executeGlobalToggle(true);
    }
  };


  const executeGlobalToggle = async (nextState: boolean) => {
    try {
      setUpdatingGlobal(true);
      const targetRef = doc(db, waAccountDoc(waId));
      await updateDoc(targetRef, { is_bot_active: nextState }).catch(async () => {
        await setDoc(targetRef, { is_bot_active: nextState }, { merge: true });
      });
      setShowConfirmModal(false);
    } catch (err) {
      console.error("Failed to update is_bot_active:", err);
    } finally {
      setUpdatingGlobal(false);
    }
  };

  // Toggle default policy for new contacts
  const handleToggleDefaultPolicy = async () => {
    try {
      setUpdatingDefault(true);
      const targetRef = doc(db, waAccountDoc(waId));
      const nextState = !defaultPolicyActive;

      await updateDoc(targetRef, {
        default_bot_active_for_new_contacts: nextState,
      }).catch(async () => {
        await setDoc(
          targetRef,
          { default_bot_active_for_new_contacts: nextState },
          { merge: true }
        );
      });
    } catch (err) {
      console.error("Failed to update default_bot_active_for_new_contacts:", err);
    } finally {
      setUpdatingDefault(false);
    }
  };

  const handleSaveQuietHours = async (e: React.FormEvent) => {


    e.preventDefault();
    try {
      setUpdatingQuiet(true);
      setQuietSaveStatus(null);

      const targetRef = doc(db, waAccountDoc(waId));
      const quietConfig = {
        enabled: quietHoursEnabled,
        start_time: quietStartTime,
        end_time: quietEndTime,
        timezone: quietTimezone,
      };

      await updateDoc(targetRef, { quiet_hours: quietConfig }).catch(async () => {
        await setDoc(targetRef, { quiet_hours: quietConfig }, { merge: true });
      });

      setQuietSaveStatus("Quiet hours saved successfully.");
      setTimeout(() => setQuietSaveStatus(null), 3000);
    } catch (err) {
      console.error("Failed to save quiet_hours:", err);
      setQuietSaveStatus("Failed to save quiet hours.");
    } finally {
      setUpdatingQuiet(false);
    }
  };

  return (
    <main className="mx-auto max-w-4xl p-4 sm:p-6 space-y-6">
      {/* Header section */}
      <div>
        <h1 className="text-xl font-medium text-text-primary">Account Settings</h1>
        <p className="text-xs text-text-secondary">
          Manage global kill switch, quiet hours schedule, default policies, and prompt library for account <code className="font-mono text-text-primary font-medium">{waId}</code>
        </p>
      </div>

      {/* 1. Global Master Kill Switch Section */}
      <GlobalKillSwitchCard
        totalChatsCount={totalChatsCount}
        isGlobalActive={isGlobalActive}
        updatingGlobal={updatingGlobal}
        loading={loading}
        handleInitiateGlobalToggle={handleInitiateGlobalToggle}
      />

      {/* 2. Scheduled Quiet Hours Section (Task 15) */}
      <QuietHoursCard
        quietHoursEnabled={quietHoursEnabled}
        setQuietHoursEnabled={setQuietHoursEnabled}
        quietStartTime={quietStartTime}
        setQuietStartTime={setQuietStartTime}
        quietEndTime={quietEndTime}
        setQuietEndTime={setQuietEndTime}
        quietTimezone={quietTimezone}
        setQuietTimezone={setQuietTimezone}
        loading={loading}
        updatingQuiet={updatingQuiet}
        quietSaveStatus={quietSaveStatus}
        handleSaveQuietHours={handleSaveQuietHours}
      />

      {/* 3. Default Policy for New Contacts Card */}

      <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <h2 className="text-sm font-medium text-text-primary">
              Default Policy for New Contacts
            </h2>
            <p className="text-xs text-text-secondary">
              Bound to <code className="font-mono bg-canvas px-1 py-0.5 rounded">wa_bot/{waId}.default_bot_active_for_new_contacts</code>. Sets whether first-time senders start with the bot enabled automatically.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-text-primary">
              {defaultPolicyActive ? "Auto-ON" : "Auto-OFF"}
            </span>

            <button
              type="button"
              disabled={updatingDefault || loading}
              onClick={handleToggleDefaultPolicy}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 disabled:opacity-50 ${
                defaultPolicyActive ? "bg-accent-active" : "bg-accent-paused"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                  defaultPolicyActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 3b. Chat Folders Section */}
      <ChatFoldersManager
        builtins={builtins}
        shownBuiltins={shownBuiltins}
        setDraftBuiltins={setDraftBuiltins}
        shownCustoms={shownCustoms}
        setDraftCustoms={setDraftCustoms}
        ensureSeeded={ensureSeeded}
        handleRemoveCustomFolder={handleRemoveCustomFolder}
        newFolderName={newFolderName}
        setNewFolderName={setNewFolderName}
        handleAddCustomFolder={handleAddCustomFolder}
        folderSaveStatus={folderSaveStatus}
        handleSaveFolders={handleSaveFolders}
        updatingFolders={updatingFolders}
        loading={loading}
        hasEdits={hasEdits}
      />

      {/* 3. Link to Prompt Library Card */}
      <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs flex items-center justify-between">
        <div>
          <h2 className="text-sm font-medium text-text-primary">Prompt Library</h2>
          <p className="text-xs text-text-secondary">
            Create, edit, and assign AI system prompt personas for this account
          </p>
        </div>

        <Link
          href={`/${encodeURIComponent(waId)}/settings/prompts`}
          className="inline-flex items-center gap-1.5 rounded-md border border-border-custom bg-canvas px-3.5 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
        >
          Manage System Prompts →
        </Link>
      </div>

      {/* Master Kill Switch Confirmation Modal */}
      {showConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-text-primary/40 p-4">
          <div className="w-full max-w-md rounded-lg border border-border-custom bg-surface p-6 shadow-lg space-y-4">
            <div className="flex items-center gap-2 text-accent-danger">
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-base font-semibold">
                Confirm Global Bot Disable
              </h3>
            </div>

            <p className="text-xs leading-relaxed text-text-primary">
              Are you sure you want to turn OFF the master bot switch for this account? This will immediately pause AI auto-replies for <strong>{activeContactsCount} currently active contact(s)</strong> across the entire account.
            </p>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={updatingGlobal}
                onClick={() => setShowConfirmModal(false)}
                className="rounded border border-border-custom bg-canvas px-4 py-2 text-xs font-medium text-text-primary transition-colors hover:bg-surface-hover"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={updatingGlobal}
                onClick={() => executeGlobalToggle(false)}
                className="rounded bg-accent-danger px-4 py-2 text-xs font-medium text-white transition-colors hover:opacity-90"
              >
                {updatingGlobal ? "Disabling..." : "Yes, Disable Global Bot"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

