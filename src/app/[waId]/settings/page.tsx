"use client";

import React, { use, useEffect, useState } from "react";
import Link from "next/link";
import { collection, doc, getCountFromServer, onSnapshot, query, setDoc, updateDoc, where } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { waAccountDoc, chatCollection } from "@/lib/firestore-paths";
import { WaAccount } from "@/types/firestore";

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
      <div className="rounded-lg border border-accent-danger/30 bg-accent-danger-bg p-5 shadow-xs">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-accent-danger animate-pulse" />
              <h2 className="text-sm font-semibold uppercase tracking-wider text-accent-danger">
                Global Master Kill Switch
              </h2>
            </div>
            <p className="text-xs text-text-primary leading-relaxed">
              Bound to <code className="font-mono bg-surface px-1 py-0.5 rounded text-[11px]">wa_bot/{waId}.is_bot_active</code>. Turning this OFF immediately stops AI auto-replies across <strong>ALL {totalChatsCount} contacts</strong> on this account.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-text-primary">
              {isGlobalActive ? "Global Bot ON" : "Global Bot OFF"}
            </span>

            <button
              type="button"
              disabled={updatingGlobal || loading}
              onClick={() => handleInitiateGlobalToggle(!isGlobalActive)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-accent-danger focus:ring-offset-2 disabled:opacity-50 ${
                isGlobalActive ? "bg-accent-active" : "bg-accent-danger"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                  isGlobalActive ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* 2. Scheduled Quiet Hours Section (Task 15) */}
      <div className="rounded-lg border border-border-custom bg-surface p-5 shadow-xs space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between border-b border-border-custom pb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-base">🌙</span>
              <h2 className="text-sm font-medium text-text-primary">Scheduled Quiet Hours</h2>
            </div>
            <p className="text-xs text-text-secondary">
              Bound to <code className="font-mono bg-canvas px-1 py-0.5 rounded">wa_bot/{waId}.quiet_hours</code>. Pauses AI auto-replies across all contacts during specified hours.
            </p>
          </div>

          <div className="flex items-center gap-3 shrink-0">
            <span className="text-xs font-medium text-text-primary">
              {quietHoursEnabled ? "Quiet Hours ON" : "Quiet Hours OFF"}
            </span>

            <button
              type="button"
              disabled={loading}
              onClick={() => setQuietHoursEnabled(!quietHoursEnabled)}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-150 ease-in-out focus:outline-none focus:ring-2 focus:ring-text-primary focus:ring-offset-2 ${
                quietHoursEnabled ? "bg-accent-active" : "bg-text-muted"
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-surface shadow-sm transition duration-150 ease-in-out ${
                  quietHoursEnabled ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </div>
        </div>

        <form onSubmit={handleSaveQuietHours} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="quiet-start-time" className="block text-xs font-medium text-text-primary mb-1">
                Start Time (24h)
              </label>
              <input
                id="quiet-start-time"
                type="time"
                value={quietStartTime}
                onChange={(e) => setQuietStartTime(e.target.value)}
                className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
              />
            </div>

            <div>
              <label htmlFor="quiet-end-time" className="block text-xs font-medium text-text-primary mb-1">
                End Time (24h)
              </label>
              <input
                id="quiet-end-time"
                type="time"
                value={quietEndTime}
                onChange={(e) => setQuietEndTime(e.target.value)}
                className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
              />
            </div>

            <div>
              <label htmlFor="quiet-timezone" className="block text-xs font-medium text-text-primary mb-1">
                Timezone
              </label>
              <input
                id="quiet-timezone"
                type="text"
                value={quietTimezone}
                onChange={(e) => setQuietTimezone(e.target.value)}
                placeholder="e.g. Asia/Jakarta"
                className="w-full rounded border border-border-custom bg-canvas px-3 py-2 text-xs text-text-primary focus:border-text-primary focus:bg-surface focus:outline-none focus:ring-1 focus:ring-text-primary"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            {quietSaveStatus ? (
              <span className="text-xs font-medium text-accent-active">{quietSaveStatus}</span>
            ) : <span />}

            <button
              type="submit"
              disabled={updatingQuiet || loading}
              className="rounded bg-text-primary px-4 py-2 text-xs font-medium text-surface transition-colors hover:bg-text-primary/90 focus:outline-none focus:ring-2 focus:ring-text-primary disabled:opacity-50"
            >
              {updatingQuiet ? "Saving Quiet Hours..." : "Save Quiet Hours Settings"}
            </button>
          </div>
        </form>
      </div>

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

